-- Seed inicial de fontes para discovery semanal
insert into sources (name, type, base_url, query_template, specialty, language, priority, is_active)
values
('PubMed - Breast Imaging', 'pubmed', 'https://pubmed.ncbi.nlm.nih.gov/', 'breast imaging OR mammography OR breast MRI', 'mama', 'en', 90, true),
('PubMed - Thoracic Imaging', 'pubmed', 'https://pubmed.ncbi.nlm.nih.gov/', 'thoracic imaging OR chest CT OR pulmonary nodule imaging', 'torax', 'en', 90, true),
('PubMed - Neuroradiology', 'pubmed', 'https://pubmed.ncbi.nlm.nih.gov/', 'neuroradiology OR brain MRI OR stroke imaging', 'neuro', 'en', 90, true),
('Europe PMC - Abdominal Imaging', 'europepmc', 'https://europepmc.org/', 'abdominal imaging OR liver MRI OR pancreatic imaging', 'abdome', 'en', 80, true),
('Guidelines - General Radiology', 'guideline_site', null, 'radiology guideline consensus update', 'geral', 'en', 95, true);
