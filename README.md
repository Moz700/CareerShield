# CareerShield

**AI-exposure-aware career transition advice for Malaysian workers, with an evaluation on outcomes the ranking does not optimise.**

<!-- After the first Zenodo release, paste the DOI badge here, e.g.
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.NNNNNNN.svg)](https://doi.org/10.5281/zenodo.NNNNNNN) -->

CareerShield combines three published occupational AI-exposure indices (Felten et al. 2021, 2023; Eloundou et al. 2024),
carries the composite onto the Malaysian occupational classification through the official SOC and ISCO-08 crosswalks, and
recommends realistic destination occupations ranked on skill similarity, exposure reduction, hiring demand and salary, with
reskilling courses from Malaysian and global catalogues. A worker enters a job title or uploads a CV and receives an exposure
diagnosis, the abilities driving it, ranked destinations and a course plan.

This repository also contains the code for the paper that evaluates CareerShield on outcomes outside its objective
(observed AI applicability from Copilot use, and United States employment and wage changes after ChatGPT) and introduces a
redesign, **v2**, that adds posting-coverage and trajectory guards and a capacity cap computed by deferred acceptance.

> Billah, M. M., Paul, A., & Al-Obaydee, M. (under review). *CareerShield: Measuring occupational exposure to generative
> artificial intelligence and advising career transitions in the Malaysian labour market.*

## Repository layout

```
app.py                         full pipeline + interactive demo as one script (generated from the notebook)
notebooks/CareerShield_pipeline.ipynb   the pipeline, validation and Gradio demo, with outputs from the reported run
evaluation/independent_evaluation.py    reproduces every number in the paper
evaluation/make_figures.py              draws Figures 1 to 4 of the paper
evaluation/output/             results.json, first_recommendations.csv and the figures
artifacts/                     occupation-level outputs of the pipeline used by the evaluation
data/raw/                      public raw data (O*NET, BLS OEWS, crosswalks, DOSM, GPT exposure)
data/third_party/              Microsoft Working with AI applicability scores (CC BY 4.0)
data/README.md                 where to download the files that are not committed
```

## 1. Reproduce the paper's results (about one minute, no downloads)

```bash
git clone https://github.com/Moz700/CareerShield.git
cd CareerShield
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r evaluation/requirements.txt
python evaluation/independent_evaluation.py
python evaluation/make_figures.py
```

Outputs are written to `evaluation/output/`. Key values you should see:

| Quantity | Expected value |
|---|---|
| Origin occupations evaluated | 820 |
| Observed AI applicability, v1 − CONV | -3.33 [-4.68, -2.13] |
| Observed AI applicability, v1 − v1-BLIND | -3.09 [-4.38, -1.92] |
| Observed AI applicability, v2 − CONV | -2.36 [-3.53, -1.14] |
| Employment 2022–24, v1 − CONV (log points) | +0.25 [-2.12, +2.16] |
| Median wage 2022–24, v1 − CONV (log points) | +0.73 [-0.20, +1.58] |
| Top-10 destination share: CONV / v1 / v2 (%) | 7.3 / 27.7 / 9.8 |
| Most frequent v1 destination | Pressers, Textile, Garment, and Related Materials (45 origins) |

Intervals are 95% cluster-bootstrap intervals (seed fixed in the script).

## 2. Run the full pipeline and the interactive demo

1. Download the five files listed in `data/README.md` into `data/raw/`.
2. `pip install -r requirements.txt` (the first run downloads the multilingual MiniLM sentence encoder from Hugging Face).
3. Either open `notebooks/CareerShield_pipeline.ipynb` in Jupyter or Google Colab and run all cells, or run `python app.py`
   from the repository root. The demo opens at http://127.0.0.1:7860 (set `CAREERSHIELD_SHARE=1` for a temporary public link).

The interactive demo runs CareerShield v1, one worker at a time. The v2 advice plan is computed jointly for all occupations
in `evaluation/independent_evaluation.py` (function `plan`).

## Data and licences

Code: MIT (`LICENSE`). Derived data files in `artifacts/` and `evaluation/output/`: CC BY-SA 4.0 (`LICENSE-DATA.md`).
Third-party raw files keep their own licences; see `THIRD_PARTY_NOTICES.md` for sources, licences and required attributions.
The e-LATiH course catalogue compiled from the HRD Corp platform is not redistributed.

## How to cite

```bibtex
@software{careershield_2026,
  author  = {Billah, Moztoba Mutashim and Paul, Aritra},
  title   = {CareerShield: AI-exposure-aware career transition advice for Malaysian workers},
  version = {1.0.0},
  year    = {2026},
  url     = {https://github.com/Moz700/CareerShield}
}
```

## Contact

Moztoba Mutashim Billah, Sunway Business School, Sunway University, Malaysia. Email: moztobamutashim@gmail.com
