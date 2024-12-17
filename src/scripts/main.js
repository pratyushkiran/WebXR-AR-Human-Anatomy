document.getElementById("enter-ar-btn").addEventListener("click", activateXR);

async function activateXR() {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl", { xrCompatible: true });
    
    const scene = setupScene();
    const camera = setupCamera();
    const renderer = setupRenderer(canvas, gl);
    const session = await setupXRSession(gl);
    const { referenceSpace, viewerSpace, hitTestSource } = await setupXRSpaces(session);
    
    const loader = new THREE.GLTFLoader();
    
    // reticle
    let reticle;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf",
        function (gltf) {
            reticle = gltf.scene;
            reticle.visible = false;
            scene.add(reticle);
        },
        undefined,
        function (error) {
            console.error("An error occurred loading the reticle model:", error);
        }
    );
    
    // sunflower pushpa
    let flower;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf",
      function(gltf) {
          flower = gltf.scene;
      }
    );
    
    // skeleton model 
    let skeleton;
    loader.load("/assets/models/skeleton_1m.glb", 
        function(gltf) {
            skeleton = gltf.scene;
            skeleton.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true; // Enable for casting shadows
                }
            });
    },);
    
    session.addEventListener("select", (event) => {
        if (skeleton) {
            const clone = skeleton.clone();
            clone.position.copy(reticle.position);
            scene.add(clone);
        };
    });

  function onXRFrame(time, frame) {
    session.requestAnimationFrame(onXRFrame);
    gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

    const pose = frame.getViewerPose(referenceSpace);
    if (pose) {
      const view = pose.views[0];
      const viewport = session.renderState.baseLayer.getViewport(view);
      renderer.setSize(viewport.width, viewport.height);
      camera.matrix.fromArray(view.transform.matrix);
      camera.projectionMatrix.fromArray(view.projectionMatrix);
      camera.updateMatrixWorld(true);

      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(referenceSpace);
        reticle.visible = true;
        reticle.position.set(
          hitPose.transform.position.x,
          hitPose.transform.position.y,
          hitPose.transform.position.z
        );
        reticle.updateMatrixWorld(true);
      }
      renderer.render(scene, camera);
    }
  }
  session.requestAnimationFrame(onXRFrame);
}

function setupScene() {
  const scene = new THREE.Scene();

  // Add lighting
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 15, 10);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.5 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  return scene;
}

function setupCamera() {
  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  return camera;
}

function setupRenderer(canvas, gl) {
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true });
  renderer.autoClear = false;
  return renderer;
}

async function setupXRSession(gl) {
  const session = await navigator.xr.requestSession("immersive-ar", { requiredFeatures: ["hit-test"] });
  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
  return session;
}

async function setupXRSpaces(session) {
  const referenceSpace = await session.requestReferenceSpace("local");
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  return { referenceSpace, viewerSpace, hitTestSource };
}
