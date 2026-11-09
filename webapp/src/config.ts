// Site-wide facts in one place. Change these here, not in the pages.

export const REPO = 'https://github.com/Moz700/CareerShield';
export const REPO_SHORT = 'github.com/Moz700/CareerShield';
export const EMAIL = 'moztobamutashim@gmail.com';
export const VERSION = '2.2.0';

// The person behind the site, shown in the header byline, the home page and the footer.
export const AUTHOR = 'Moztoba Mutashim Billah';
export const GITHUB_PROFILE = 'https://github.com/Moz700';
export const LINKEDIN = 'https://www.linkedin.com/in/moztoba-mutashim-billah';

// Title of the journal paper this app accompanies, as on the manuscript. Update it if the
// submitted title changes.
export const PAPER_TITLE =
  'CareerShield: Measuring occupational exposure to generative artificial intelligence and advising career transitions in the Malaysian labour market';
export const PAPER_AUTHORS = 'Billah, Moztoba Mutashim and Paul, Aritra and Al-Obaydee, Mohammed';
export const PAPER_NOTE = 'Manuscript in preparation';

export const BIB_PAPER = `@unpublished{billah2026careershield,
  author = {${PAPER_AUTHORS}},
  title  = {${PAPER_TITLE}},
  year   = {2026},
  note   = {${PAPER_NOTE}}
}`;

export const BIB_SOFTWARE = `@software{careershield_2026,
  author  = {Billah, Moztoba Mutashim and Paul, Aritra},
  title   = {CareerShield: AI-exposure-aware career transition advice for Malaysian workers},
  version = {${VERSION}},
  year    = {2026},
  url     = {${REPO}}
}`;
