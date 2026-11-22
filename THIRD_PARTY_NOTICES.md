# Third-party notices

The browser build uses React 19.3.1, React DOM 19.3.1 and Scheduler 0.28.0 under
the MIT license. The ZIP worker uses fflate 0.8.3 (MIT), Copyright (c) 2026
Arjun Barrett, for streaming Deflate decompression. Vite 8.3.8 contributes generated preload helpers under MIT.
Their copyright notices and license text are included in
[public/third-party-notices.txt](public/third-party-notices.txt), which Vite copies
to the root of `dist/` on build. Preserve that file when distributing the frontend.

The [dependency inventory](docs/dependency-licenses.md) distinguishes shipped code
from development/test tools and their transitive licenses. Installed packages retain
their own full notices. Prompt 5 adds the GPL-licensed emulators/DOSBox build and
redistributable FreeDOS test fixtures. The [runtime audit](docs/runtime-license-audit.md),
[full runtime notices](vendor/dos/NOTICE.txt) and [retained source inventory](vendor/dos/README.md)
cover their separate grants. `runtime:assets` verifies and copies these sources/notices
into the local build. No proprietary OS, ROM, BIOS or commercial application is
bundled. Original icons are simple inline SVGs.

Original PHANTOM source is GPL-2.0-only; see [LICENSE](LICENSE) and the
[distribution-license review](docs/release-license-review.md). Third-party
components retain their grants. Source rebuild and HTTPS acceptance gates are
separate from this license choice. Public runtime release is not yet cleared.
The Prompt 11 archive audit removed two unused, unaudited benchmark executables;
see the review for the correction to earlier inventory claims.
