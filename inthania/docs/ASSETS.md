# Asset provenance

All playable character and nature models are actual binary glTF 2.0 assets, rendered using WebGL. Characters use authored skeletal animations. The campus, terrain, turbines, glider and ability geometry are original parametric 3D meshes.

| Files | Author / source | License | Processing |
|---|---|---|---|
| `mage.glb`, `rogue.glb`, `knight.glb`, `barbarian.glb` | [Kay Lousberg — KayKit Adventurers 1.0](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0), commit `672074b73ba276876a19e8816ecdc5241817ab47` | CC0 1.0; copy in `assets/models/KAYKIT-LICENSE.txt` | Retained 16 gameplay animation clips, removed unused animation buffers, embedded source textures. Meshes and skeletons retained. Runtime tints distinguish disciplines. |
| Trees, rocks, bushes, flowers, bridge, boat, tent, campfire, lily | [Kenney — Nature Kit](https://kenney.nl/assets/nature-kit) | CC0 1.0; copy in `assets/models/KENNEY-LICENSE.txt` | Selected GLB models from source package, unchanged. Runtime scaling and instancing. |
| `robot.glb` | Tomás Laulhé / Quaternius, modifications by Don McCurdy; [Three.js RobotExpressive sample](https://github.com/mrdoob/three.js/tree/r170/examples/models/gltf/RobotExpressive) | CC0 as credited in [the source example](https://github.com/mrdoob/three.js/blob/r170/examples/webgl_animation_skinning_morph.html) | Used unchanged for patrol robots and a scaled boss. |
| `three.module.js`, `GLTFLoader.js`, utilities | [Three.js r170](https://github.com/mrdoob/three.js/tree/r170) | MIT; copy in `assets/vendor/THREE-LICENSE.txt` | Vendored; adjusted GLTFLoader's utility import to the local flat directory. |
| `NotoSansThai.ttf` | [Noto Sans Thai — Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosansthai) | SIL Open Font License 1.1; copy in `assets/fonts/OFL.txt` | Local variable font, unchanged. Loaded before drawing Thai 3D labels. |

Downloaded 7 October 2026. SHA-256 values for shipped assets are listed in `asset-manifest.json`. No remote CDN is required while playing. No Genshin models, characters, textures, music, voice lines, logos or original code are included.
