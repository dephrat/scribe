import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin

PAGE_CAP = 1000       # chars kept per page
TOTAL_CAP = 20000     # chars of crawled content handed to the model
MAX_SUB_SITEMAPS = 10 # sub-sitemaps followed from a sitemap index

def crawl_page(url, domain, page_cap=PAGE_CAP):
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")

        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        text = soup.get_text(separator="\n")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        content = "\n".join(lines)

        content = re.sub(r'https?://(?!' + re.escape(domain) + r')\S+', '', content)
        content = re.sub(r'www\.(?!' + re.escape(domain) + r')\S+', '', content)

        return content[:page_cap]
    except Exception as e:
        print(f"Crawl failed for {url}: {e}")
        return ""

def get_internal_links(url, domain):
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        links = set()
        for a in soup.find_all('a', href=True):
            href = urljoin(url, a['href'])
            parsed = urlparse(href)
            if parsed.netloc == domain and parsed.scheme in ('http', 'https'):
                clean = parsed.scheme + "://" + parsed.netloc + parsed.path
                links.add(clean)
        return links
    except Exception as e:
        print(f"Failed to get links from {url}: {e}")
        return set()

def crawl_website(url, max_pages=10, additional_urls=None, exclude_patterns=None):
    domain = urlparse(url).netloc
    visited = set()
    all_content = []

    sitemap_urls = get_sitemap_urls(url, exclude_patterns)
    if sitemap_urls:
        queue = sitemap_urls
    else:
        queue = [url]

    if additional_urls:
        queue = additional_urls + queue

    while queue and len(visited) < max_pages:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)

        print(f"Crawling: {current}")
        content = crawl_page(current, domain)
        if content:
            all_content.append(f"--- {current} ---\n{content}")

        if not sitemap_urls:
            new_links = get_internal_links(current, domain)
            for link in new_links:
                if link not in visited:
                    queue.append(link)

    combined = "\n\n".join(all_content)
    print(f"Crawled {len(visited)} pages, {len(combined)} chars (cap {TOTAL_CAP})")
    return combined[:TOTAL_CAP]

def get_sitemap_urls(base_url, exclude_patterns=None):
    """Return page URLs from the site's sitemap.

    Handles both a flat sitemap and a sitemap index (a sitemap of sitemaps),
    which is what most CMS-generated sites publish. Only same-origin page URLs
    are returned; sub-sitemap .xml URLs never are, since crawling those as
    pages would feed raw XML to the model.
    """
    exclude_patterns = exclude_patterns or []
    parsed = urlparse(base_url)
    domain_base = parsed.scheme + "://" + parsed.netloc

    def keep(u):
        return (u.startswith(domain_base)
                and not u.endswith(".xml")
                and not any(pat in u for pat in exclude_patterns))

    def locs(markup):
        return [loc.text.strip() for loc in BeautifulSoup(markup, "xml").find_all("loc")]

    try:
        sitemap_url = base_url.rstrip("/") + "/sitemap.xml"
        response = requests.get(sitemap_url, timeout=10)
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.text, "xml")
        sub_sitemaps = [loc.text.strip() for sitemap in soup.find_all("sitemap")
                        for loc in [sitemap.find("loc")] if loc]

        if sub_sitemaps:
            urls = []
            for sub in sub_sitemaps[:MAX_SUB_SITEMAPS]:
                try:
                    sub_response = requests.get(sub, timeout=10)
                    if sub_response.status_code == 200:
                        urls.extend(locs(sub_response.text))
                except Exception as e:
                    print(f"Sub-sitemap fetch failed for {sub}: {e}")
            return [u for u in urls if keep(u)]

        return [u for u in locs(response.text) if keep(u)]
    except Exception as e:
        print(f"Sitemap fetch failed: {e}")
    return []
