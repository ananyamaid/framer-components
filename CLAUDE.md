# Ananya's Framer Component Library

This repo is a collection of custom web components made by @ui.ananya_. Each folder inside /components is one component, with its code and a README explaining how it works and what its controls do.

Components in this library:
- components/dangle-necklace: a pendant hanging on a physics chain that visitors can grab and swing
- components/metallic-frame: a spiky chrome frame around an image that can reflect the visitor through their camera
- components/emboss-footer: a metal footer plate with a name embossed in the middle that visitors can draw on

When using this library:
- Read the README inside a component's folder before using it.
- Keep the visual style of each component exactly as it is. Do not simplify the animations, the lighting or the physics, and do not swap the design for a more generic version.
- These were written as Framer code components. If the project is Next.js or plain React, remove the import from "framer" and the addPropertyControls block, and pass the controls as normal props. Keep the behaviour the same.
- The components do not need any extra libraries. The metallic frame and emboss footer use WebGL, so add "use client" at the top of those files in Next.js.
- Use the components where they make sense in the design, for example the emboss footer at the bottom of a page and the metallic frame around a portrait or product image.
