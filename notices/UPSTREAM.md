# Upstream attribution and distribution

Rocket Designer is an independent application, not an official OpenRocket product or endorsement.

OpenRocket core: https://github.com/openrocket/openrocket, tag release-24.12, commit 133b558de556f0282f51c3f53f3b3fc633b4310a. Copyright (C) 2007–2022 Sampo Niskanen and others; retain the actual upstream LICENSE.TXT and source-file notices. GPL version 3 or later, with the additional section 7 data-packaging permission reproduced in OpenRocket-LICENSE.txt. The adapter and frontend are distributed as GPL-3.0-or-later. This notice does not relicense third-party components.

Modifications: upstream source is unmodified. The build stages source files excluding module-info.java into generated classpath sources for the headless application, uses the same core dependency declarations and resources, and adds the rocket.* HTTP adapter and independent React UI. No desktop Swing module is loaded. Gradle resolves transitive versions according to the pinned core dependency graph; backend/gradle.lockfile records the actual graph.

Component database: openrocket/openrocket-database commit 1512874ace50917e25ccf7d7df1f616b5f39a8b5, Apache-2.0. Its exact LICENSE and README accompany this project. Templates identify manufacturers and part numbers as supplied by that database.

Motor curves: core/src/main/resources/datafiles/thrustcurves/thrustcurves.ser is taken unchanged from the pinned core commit. Metadata/descriptions are exposed from the source database. Core/resources-src/datafiles/thrustcurves includes original data and comments where present. Data packaging permission does not imply ownership of external motor data or trademark rights; preserve provenance and original notices. Imported motor files remain separate user data with SHA-256 provenance. No motors or thrust curves were fabricated.

Examples: tests/fixtures/*.ork are unmodified copies of the corresponding OpenRocket examples in the pinned source. No imagery, desktop icons, fonts, logos or spheres are used in the independent browser UI. Bundled runtime resources still retain their upstream directory contents and notices.

Third-party Java libraries retain their own licenses/notices in their original JAR META-INF resources; the Gradle install distribution keeps those original JARs, rather than stripping or shading them. React, Vite, TypeScript and development tooling retain package licenses in node_modules; dependency lockfiles identify versions. Run scripts/package-source.sh to include the complete pinned upstream source and database in a corresponding-source archive before distributing this application. Serve/convey that archive alongside binaries, retain all notices, and provide recipients GPL rights and source availability as applicable. Do not distribute a binary-only package without corresponding source arrangements. Review the separate data and third-party notices for your distribution.
