# Third-Party Notices

## Editor Fallback Fonts

Noto Sans, Noto Serif, Carlito, Caladea, Arimo, Tinos, and Cousine (regular,
bold, italic, and bold italic) are bundled unmodified under the SIL Open Font
License 1.1. The metric-compatible families cover common documents authored
with Calibri/Aptos, Cambria, Arial/Helvetica, Times New Roman, and Courier New;
Noto provides the general Unicode fallback. PenguinPDF does not redistribute
Microsoft, Apple, or Adobe proprietary fonts.

The upstream copyright notices and full licenses are included in app resources
as `bin/fonts/LICENSE`, `CARLITO-OFL.txt`, `CALADEA-OFL.txt`, `ARIMO-OFL.txt`,
`TINOS-OFL.txt`, and `COUSINE-OFL.txt`. Exact source revisions and SHA-256
checksums are recorded in `bin/fonts/manifest.json`.

Sources: https://github.com/notofonts/noto-fonts,
https://github.com/google/fonts/tree/main/ofl/carlito,
https://github.com/huertatipografica/Caladea,
https://github.com/googlefonts/arimo, https://github.com/googlefonts/tinos, and
https://github.com/googlefonts/cousine.
The OFL applies to the fonts, not PenguinPDF's source code or created documents.

This file lists major third-party libraries bundled with or used by PenguinPDF. PenguinPDF does not use paid/commercial dependency licenses.

## Bundled Or Linked In The App

- Tauri: Apache License 2.0 / MIT ecosystem components
- React, React DOM, React Router: MIT License
- pdf-lib: MIT License
- PDF.js / pdfjs-dist: Apache License 2.0
- Fabric.js: MIT License
- lucide-react / Lucide icons: ISC License
- pdfcpu: Apache License 2.0
- PDFium: BSD 3-Clause License
- Tesseract OCR 5.5.2: Apache License 2.0
- Tesseract tessdata_fast language data: Apache License 2.0
- Leptonica 1.87.0: BSD 2-Clause License
- libjpeg-turbo 3.2.0: BSD 3-Clause, IJG, and zlib licenses
- XZ/liblzma 5.8.3: public-domain and permissive notices in the bundled license file
- libpng 1.6.58: libpng License 2.0
- libtiff 4.7.2: libtiff license
- zlib 1.3.2: zlib License
- pdfium-render: MIT License / Apache License 2.0
- docx-rs: MIT License
- lopdf: MIT License
- printpdf: MIT License
- image: MIT License
- Space Grotesk font: SIL Open Font License 1.1

PenguinPDF builds its bundled Tesseract executable from the pinned upstream
sources above with a pinned Microsoft vcpkg baseline. The executable is linked
statically to the OCR support libraries, so no opaque third-party OCR installer
or Homebrew runtime is redistributed. Exact versions, source baseline, binary
and model SHA-256 checksums, and complete target-package notices are included in
`bin/ocr/manifest.json` and `bin/licenses/ocr/<platform>/` in each installer.

The installer also contains `bin/licenses/DEPENDENCY_LICENSES.txt`, generated
from the locked npm and Cargo dependency closures with package versions, license
expressions, upstream source locations, and the complete license/notice texts
distributed by those packages. Pinned PDFium distribution and component
licenses are in `bin/licenses/pdfium/<platform>/`; pdfcpu's full Apache-2.0
license and release manifest are in `bin/licenses/pdfcpu/`.

## External User-Installed Tools

- LibreOffice: not bundled; used for Word -> PDF when installed by the user. LibreOffice is distributed by The Document Foundation and includes its license texts in the installer.
- System Tesseract OCR: optional fallback if PenguinPDF's bundled local OCR component is unavailable.

## License References

- Tauri: https://github.com/tauri-apps/tauri
- React: https://github.com/facebook/react
- pdf-lib: https://github.com/Hopding/pdf-lib
- PDF.js: https://github.com/mozilla/pdf.js
- Fabric.js: https://github.com/fabricjs/fabric.js
- Lucide: https://github.com/lucide-icons/lucide
- pdfcpu: https://github.com/pdfcpu/pdfcpu
- PDFium: https://pdfium.googlesource.com/pdfium/
- Tesseract OCR: https://github.com/tesseract-ocr/tesseract
- Tesseract tessdata_fast: https://github.com/tesseract-ocr/tessdata_fast
- pdfium-render: https://crates.io/crates/pdfium-render
- docx-rs: https://crates.io/crates/docx-rs
- LibreOffice: https://www.libreoffice.org/licenses/
- Space Grotesk: see `src/assets/fonts/OFL.txt`

## Apache License 2.0

```
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/
```

Apache-licensed components include PDF.js, pdfcpu, Tesseract OCR, Tesseract language data, and parts of the Rust/Tauri dependency stack. Full license text is available from the upstream projects listed above.

## BSD 3-Clause License

```
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the BSD 3-Clause conditions are met.
```

PDFium is distributed under a BSD-style license. Full license text is available from the upstream PDFium project.

## MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, subject to the conditions in the MIT License.
```

MIT-licensed components include React, pdf-lib, Fabric.js, docx-rs, lopdf, printpdf, image, and related tooling. Full license text is available from each upstream project.

## ISC License

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the copyright
notice and permission notice appear in all copies.
```

Lucide icons are distributed under the ISC License.

## SIL Open Font License 1.1

Space Grotesk and the editor fallback fonts are distributed under the SIL Open
Font License 1.1. Their unmodified license files ship beside the font resources.
# PDF.js Standard Fonts

The locally bundled PDF.js font resources include PDFium/Foxit substitute fonts
(BSD-3-Clause, Copyright 2014 PDFium Authors) and Liberation fonts (SIL OFL-1.1,
Copyright 2010 Google Corporation and 2012 Red Hat, Inc.). Unmodified font files
and their complete `LICENSE_FOXIT` and `LICENSE_LIBERATION` notices are included
in the application web resources under `pdfjs/standard_fonts/`. These are used
offline for PDF previews and do not change PenguinPDF's source-code license.
