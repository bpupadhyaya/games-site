# Credits and licences for the Arcforge 3D person layer (view3d)

Games that ship the 3D layer must show this text (or a faithful copy) in their About screen
(`fetch('./vendor3d/LICENSES.md')`). It is public text; keep it as is.

## Characters: Microsoft Rocketbox Avatar Library (MIT)

The athletes are derived from avatars of the Microsoft Rocketbox Avatar Library
(https://github.com/microsoft/Microsoft-Rocketbox): meshes and skeletons are used as published, textures were
repainted (logos and lettering removed, clothing recoloured for team kits). The animations in the base clip set that come
from Rocketbox are used the same way.

MIT License

Copyright (c) 2020 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Motion data

* Quaternius, "Universal Animation Library" and "Universal Animation Library 2" (CC0 1.0 Universal, public domain):
  https://quaternius.com. Animations by @Quaternius; attribution is not required and is given as a courtesy.
* Carnegie Mellon University Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu): "The data used in this
  project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." BVH conversion
  by Bruce Hahne (cgspeed.com). Used: kick (subject 74), throw (subject 15), golf swing (subject 64), retargeted to a different skeleton.

## Software

* three.js, Copyright (c) 2010-2024 three.js authors, MIT License (https://threejs.org), including the addons GLTFLoader,
  SkeletonUtils and RoomEnvironment.
* meshoptimizer decoder (MeshoptDecoder), Copyright (c) 2016-2024 Arseny Kapoulkine, MIT License
  (https://github.com/zeux/meshoptimizer), bundled through three.js.
