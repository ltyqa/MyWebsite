import unittest

from app.parsers import digest, parse_code_structure, split_markdown


class ParserTests(unittest.TestCase):
    def test_markdown_preserves_headings_and_splits_long_sections(self):
        chunks = split_markdown("# 标题\n\n" + "知识内容。" * 300)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunk.heading == "标题" for chunk in chunks))

    def test_code_parser_indexes_signatures_not_full_source(self):
        source = "export function search(query: string) {\n  const secret = 'not indexed';\n}\nclass Indexer {}"
        chunks = parse_code_structure("src/search.ts", source)
        self.assertEqual(chunks[0].symbols, ("search", "Indexer"))
        self.assertNotIn("not indexed", chunks[0].content)

    def test_digest_is_stable(self):
        self.assertEqual(digest("same"), digest("same"))
        self.assertNotEqual(digest("same"), digest("different"))


if __name__ == "__main__":
    unittest.main()

