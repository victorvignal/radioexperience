# OCR-Needed PDFs

> Generated: 2026-03-29 by scan_all_pdfs.py
> These files have no extractable text layer (avg < 20 chars/page in first 5 pages).
> They require OCR before they can be ingested into the RAG pipeline.

## Summary

- **Total PDFs:** 185
- **text_ok:** 154 (83%)
- **borderline (20–99 c/pg):** 4
- **needs_ocr:** 23 (12%)
- **error (corrupted/unreadable):** 4 (2%)

---

## needs_ocr (23 files)

| Path | Pages |
|------|-------|
| _duplicates/mama/guidelines/Mama_Guideline_Birads_V2025_2_... | 886 |
| _duplicates/torax/books/Torax_Livro_Radiografia_De_Torax_... | 138 |
| geral/cabeca_pescoco/books/Cabeca_Pescoco_Livro_Diagnostico_Por_Ultrassom_Cabeca_E_Pescoco_Ahuja_2016.pdf | 1405 |
| geral/cabeca_pescoco/books/Cabeca_Pescoco_Livro_Expert_Ddx_Head_And_Neck_Desconhecido_2011.pdf | 764 |
| geral/geral_core/articles/Geral_Script_Posicionamentos_Em_Exames_Contrastados_... | 170 |
| geral/geral_core/books/Geral_Livro_Atlas_De_Anatomia_Radiografica_Ufjf_2014.pdf | 57 |
| geral/geral_core/books/Geral_Livro_Atlas_De_Medidas_Radiologicas_Keats_2007.pdf | 635 |
| geral/geral_core/books/Geral_Outro_Tomografia_Computadorizada_Alex_2010.pdf | 89 |
| geral/geral_core/guidelines/Geral_Guideline_Manual_De_Meios_De_Contraste_... | 257 |
| geral/obstetricia/books/Obstetricia_Livro_Ginecologia_E_Obstetricia_Febrasgo_... | 1551 |
| geral/obstetricia/guidelines/Obstetricia_Guideline_Cbr_Pelve_Feminina_Cbr_2025.pdf | 168 |
| intervencao/books/Vascular_Livro_Doppler_Sem_Segredos_Semautor_2015.pdf | 350 |
| mama/books/Mama_Livro_Ecografia_De_Mama_... | 1014 |
| mama/guidelines/Mama_Guideline_Birads_V2025_Mamografia_Semautor_2025_...pdf | 886 |
| mama/guidelines/Mama_Guideline_Mama_Cbr_Mamografia_Camscanner_2024_Cbr_SemAno.pdf | 221 |
| msk/books/Msk_Livro_Art3a1010072... | 43 |
| msk/books/Msk_Livro_Atlas_De_Rm_Msk_Desconhecido_2017.pdf | 400 |
| msk/guidelines/Msk_Guideline_Cbr_Msk_2024_Revisar_Camscanner_2025_Cbr_SemAno.pdf | 320 |
| pediatria/books/Pediatria_Livro_Ultrassom_Pediatrico_Desconhecido_SemAno.pdf | 327 |
| radioprotecao/books/Fisica_Medica_Livro_Manual_De_Fisica_Radiologica_... | 221 |
| radioprotecao/books/Fisica_Medica_Livro_Medicina_Nuclear_Usp_SemAno.pdf | 460 |
| torax/books/Torax_Livro_433549452_Radiografia_De_Torax_... | 138 |
| torax/books/Torax_Livro_High-resolution_Ct_Of_The_Lung_Webb_2020.pdf | 1846 |

---

## borderline (4–5 files, 20–99 c/pg — may work but noisy)

- Abdome_Livro_Textbook_Of_Gastrointestinal_Radiology_5e_2021 (99 c/pg, 1104p)
- TI-RADS-Assessment-Categories.pdf (31 c/pg, 1p) — likely a form/image page
- Pediatria_Livro_Imaging_Of_The_Newborn_Infant_And_Young_Child_Swischuk (60 c/pg, 627p)
- Pediatria_Livro_Pediatric_Radiology_Rotations_In_Radiology (90 c/pg, 552p)

---

## error (4 files — corrupted or encrypted)

- Cabeca_Pescoco_Livro_Head_And_Neck_Imaging_Som_SemAno.pdf
- Mama_Livro_Diagnostic_Imaging_Breast_E_Book_Mamografia_Wendie_Semautor.pdf
- Pediatria_Outro_Ossos_De_Punhos_E_Maos_-_Tabela_De_Ossificacao_Desconhecido.pdf
- Fisica_Medica_Livro_Modern_Diagnostic_X-ray_Sources_Behling_SemAno.pdf

---

## Key Observations

1. **BI-RADS v2025** (the primary mama guideline) is scanned — needs OCR. High priority.
2. **CBR guidelines** in mama, MSK are mostly scanned (CamScanner origin).
3. **High-Resolution CT of the Lung Webb 2020** (1846p) is the biggest needs_ocr hit in torax.
4. **Expert DDX Head & Neck** and **Diagnostico Ultrassom Cabeça** are scanned (cabeca_pescoco not yet piloted).
5. Two duplicate files in `_duplicates/` also needs_ocr — low priority.

## OCR Options (for future implementation)

- **tesseract** (free): `tesseract <pdf> <out> -l por+eng pdf`
  - Requires conversion to images first: `pdftoppm` or `fitz`
- **easyocr** (Python): handles PT-BR well
- **Unstructured.io** or **surya**: better layout preservation
- For now: skip needs_ocr files in pipeline; flag for manual OCR batch later
