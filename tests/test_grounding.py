"""Tests for the grounding layer.

The README claims two mechanical guarantees about what reaches the model:
external URLs never survive a crawl, and sitemap indexes never leak their own
.xml URLs in as pages. These tests hold those claims honest. No network: every
HTTP call is stubbed.
"""

import unittest
from unittest.mock import patch

from crawler import crawl_page, get_sitemap_urls, crawl_website


class FakeResponse:
    def __init__(self, text, status_code=200):
        self.text = text
        self.status_code = status_code


def stub_get(pages):
    """Serve canned bodies by URL; anything unexpected is a 404."""
    def _get(url, **kwargs):
        if url in pages:
            return FakeResponse(pages[url])
        return FakeResponse("", status_code=404)
    return _get


class ExternalUrlStripping(unittest.TestCase):
    """The model can only cite a link if it survives this step."""

    HTML = """
        <html><body>
          <p>Book at https://example.com/booking or call us.</p>
          <p>We are reviewed on https://tripadvisor.com/xyz and www.yelp.com/biz</p>
          <p>Our sister page is https://example.com/about</p>
        </body></html>
    """

    def content(self):
        with patch("crawler.requests.get", stub_get({"https://example.com/": self.HTML})):
            return crawl_page("https://example.com/", "example.com")

    def test_strips_external_urls(self):
        content = self.content()
        self.assertNotIn("tripadvisor.com", content)
        self.assertNotIn("yelp.com", content)

    def test_keeps_own_domain_urls(self):
        content = self.content()
        self.assertIn("https://example.com/booking", content)
        self.assertIn("https://example.com/about", content)

    def test_keeps_surrounding_prose(self):
        """Stripping must remove links, not gut the sentence around them."""
        self.assertIn("call us", self.content())

    def test_respects_page_cap(self):
        long_html = "<html><body>" + ("word " * 5000) + "</body></html>"
        with patch("crawler.requests.get", stub_get({"https://example.com/": long_html})):
            content = crawl_page("https://example.com/", "example.com", page_cap=200)
        self.assertLessEqual(len(content), 200)

    def test_failed_fetch_yields_no_content(self):
        def boom(url, **kwargs):
            raise ConnectionError("network down")
        with patch("crawler.requests.get", boom):
            self.assertEqual(crawl_page("https://example.com/", "example.com"), "")


class SitemapDiscovery(unittest.TestCase):
    INDEX = """<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://example.com/posts-sitemap.xml</loc></sitemap>
          <sitemap><loc>https://example.com/products-sitemap.xml</loc></sitemap>
        </sitemapindex>"""

    POSTS = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/blog/one</loc></url>
          <url><loc>https://example.com/event-details/gala</loc></url>
        </urlset>"""

    PRODUCTS = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/shop/widget</loc></url>
          <url><loc>https://elsewhere.com/spam</loc></url>
        </urlset>"""

    FLAT = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/about</loc></url>
          <url><loc>https://elsewhere.com/spam</loc></url>
        </urlset>"""

    def index_pages(self):
        return {
            "https://example.com/sitemap.xml": self.INDEX,
            "https://example.com/posts-sitemap.xml": self.POSTS,
            "https://example.com/products-sitemap.xml": self.PRODUCTS,
        }

    def test_index_never_returns_xml_urls_as_pages(self):
        """A sitemap index lists sitemaps, not pages. Crawling those as pages
        would feed raw XML to the model."""
        with patch("crawler.requests.get", stub_get(self.index_pages())):
            urls = get_sitemap_urls("https://example.com/")
        self.assertEqual([u for u in urls if u.endswith(".xml")], [])

    def test_index_follows_every_sub_sitemap(self):
        with patch("crawler.requests.get", stub_get(self.index_pages())):
            urls = get_sitemap_urls("https://example.com/")
        self.assertIn("https://example.com/blog/one", urls)
        self.assertIn("https://example.com/shop/widget", urls)

    def test_offsite_urls_are_dropped(self):
        with patch("crawler.requests.get", stub_get(self.index_pages())):
            urls = get_sitemap_urls("https://example.com/")
        self.assertNotIn("https://elsewhere.com/spam", urls)

    def test_exclude_patterns_are_honoured(self):
        with patch("crawler.requests.get", stub_get(self.index_pages())):
            urls = get_sitemap_urls("https://example.com/", ["/event-details/"])
        self.assertNotIn("https://example.com/event-details/gala", urls)
        self.assertIn("https://example.com/blog/one", urls)

    def test_nested_index_does_not_leak_xml_urls(self):
        """Some sites nest an index inside an index. The second level must not
        come back as pages either."""
        nested = """<?xml version="1.0" encoding="UTF-8"?>
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <sitemap><loc>https://example.com/posts-1.xml</loc></sitemap>
              <sitemap><loc>https://example.com/posts-2.xml</loc></sitemap>
            </sitemapindex>"""
        pages = dict(self.index_pages())
        pages["https://example.com/posts-sitemap.xml"] = nested
        with patch("crawler.requests.get", stub_get(pages)):
            urls = get_sitemap_urls("https://example.com/")
        self.assertEqual([u for u in urls if u.endswith(".xml")], [])
        self.assertIn("https://example.com/shop/widget", urls)

    def test_flat_sitemap_listing_a_sitemap_is_not_a_page(self):
        flat_with_xml = """<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/about</loc></url>
              <url><loc>https://example.com/extra-sitemap.xml</loc></url>
            </urlset>"""
        pages = {"https://example.com/sitemap.xml": flat_with_xml}
        with patch("crawler.requests.get", stub_get(pages)):
            urls = get_sitemap_urls("https://example.com/")
        self.assertEqual(urls, ["https://example.com/about"])

    def test_flat_sitemap_still_works(self):
        pages = {"https://example.com/sitemap.xml": self.FLAT}
        with patch("crawler.requests.get", stub_get(pages)):
            urls = get_sitemap_urls("https://example.com/")
        self.assertEqual(urls, ["https://example.com/about"])

    def test_missing_sitemap_returns_empty(self):
        """A 404 must fall through to link discovery, not raise."""
        with patch("crawler.requests.get", stub_get({})):
            self.assertEqual(get_sitemap_urls("https://example.com/"), [])


class CrawlBudget(unittest.TestCase):
    def test_stops_at_max_pages(self):
        sitemap = ("""<?xml version="1.0"?><urlset>"""
                   + "".join(f"<url><loc>https://example.com/p{i}</loc></url>" for i in range(20))
                   + "</urlset>")
        pages = {"https://example.com/sitemap.xml": sitemap}
        for i in range(20):
            pages[f"https://example.com/p{i}"] = f"<html><body>page {i}</body></html>"

        with patch("crawler.requests.get", stub_get(pages)):
            content = crawl_website("https://example.com/", max_pages=3)
        self.assertEqual(content.count("--- https://example.com/p"), 3)


if __name__ == "__main__":
    unittest.main()
