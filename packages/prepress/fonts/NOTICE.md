# JetBrains Mono

The print build embeds this face in every diagram label, so the PDF carries a
known open-licensed font rather than whatever `ui-monospace` resolves to on the
machine that built it. Typst is given this directory with `--font-path`; it is
not installed system-wide.

- Upstream: <https://github.com/JetBrains/JetBrainsMono>
- Release: v2.304
- Archive: `JetBrainsMono-2.304.zip` from that release's assets
- Licence: SIL Open Font License 1.1, copied verbatim in `OFL.txt`

| File | sha256 |
| --- | --- |
| `JetBrainsMono-Regular.ttf` | `a0bf60ef0f83c5ed4d7a75d45838548b1f6873372dfac88f71804491898d138f` |
| `JetBrainsMono-SemiBold.ttf` | `1b3bfa1ed5665a4ce3f9feb68d2d4e40e70bf8b4b7d9a3edd418f321b4e166a0` |
| `JetBrainsMono-Bold.ttf` | `5590990c82e097397517f275f430af4546e1c45cff408bde4255dad142479dcb` |
| `OFL.txt` | `30f0c136e3c88e422d0791acd97238870f9054a9729bc34cf2ff0d4ed8cac4ad` |

Diagram labels use weights 600 and 700; Regular is here for any glyph the
heavier faces do not cover and for a reader who renders the SVGs elsewhere.
