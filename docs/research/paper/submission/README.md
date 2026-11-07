# Submission files (LEAD-2027)

| File | Use |
|---|---|
| `ERMA-GRC_full-paper_review-copy.docx` / `.pdf` | The paper on the full-paper template. Anonymous: no names in the text or the file metadata. |
| `ERMA-GRC_title-page.docx` / `.pdf` | Authors, affiliations, corresponding author and the AI-use declaration. Send it separately if the organisers ask for it. |
| `ERMA-GRC_abstract.docx` / `.pdf` | The abstract on the abstract template. Backup only: do not submit it alongside the full paper for the same work. |

**Rebuild** from the section drafts in `docs/research/paper/`:

```bash
python3 -I docs/research/paper/build_docx.py <full-paper-template.docx> <abstract-template.docx>
```

**Before submitting:**
- Read the whole text and rewrite it in your own words where needed, to stay under the 10% similarity limit.
- Check every reference against its source.
- Confirm the corresponding author.
