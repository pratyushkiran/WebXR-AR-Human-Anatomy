// Event listener for the "Enter AR" button
document.getElementById("enter-ar-btn").addEventListener("click", activateXR);
let xrButton = document.getElementById("enter-ar-btn");

async function activateXR() {
    // Create a canvas element and append it to the body
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl", { xrCompatible: true });  // Get WebGL context compatible with XR
    
    // Create the overlay div to hold buttons for model selection and spawning
    const overlay = document.createElement("div");
    overlay.id = "overlay";

    // Create a back button and position it at the top left
    const backButton = document.createElement("button");
    backButton.id = "back-button";
    // backButton.textContent = "Back";

    // Create an image element for the back button
    const backImage = document.createElement("img");
    backImage.src = "assets/images/back_button_white.png"; 
    backButton.appendChild(backImage);

    // Create buttons for selecting models and spawning them
    const skeletonButton = document.createElement("button");
    skeletonButton.id = "model-skeleton";
    skeletonButton.textContent = "Skeleton";

    const flowerButton = document.createElement("button");
    flowerButton.id = "model-flower";
    flowerButton.textContent = "Flower";

    const spawnButton = document.createElement("button");
    spawnButton.id = "spawn-button";
    spawnButton.textContent = "Place 3D Model";

    // Append buttons to the overlay
    overlay.appendChild(backButton);  
    overlay.appendChild(skeletonButton);
    overlay.appendChild(flowerButton);
    overlay.appendChild(spawnButton);

    // Append the overlay to the body
    document.body.appendChild(overlay);

    // Event listeners for model selection buttons
    skeletonButton.addEventListener("click", () => {
      console.log("Skeleton model selected");
      selectedModel = "skeleton";  // Set selected model to skeleton
    });

    flowerButton.addEventListener("click", () => {
      console.log("Flower model selected");
      selectedModel = "flower";  // Set selected model to flower
    });

    // Event listener for spawning the selected model at reticle location
    spawnButton.addEventListener("click", () => {
      if (reticle && reticle.visible) {
        console.log(`${selectedModel} model spawned at reticle location`);
        // Spawn the selected model
        const modelToSpawn = selectedModel === "flower" ? flower : skeleton;
        if (modelToSpawn) {
          const clone = modelToSpawn.clone();
          clone.position.copy(reticle.position);  // Place the model at the reticle's position
          scene.add(clone);
        }
      } else {
        console.log("Reticle is not visible. Cannot place model.");
      }
    });

    // Handle back button click
    backButton.addEventListener("click", () => {
        console.log("Back button clicked. Exiting AR...");
        exitAR();  // Function to exit AR and return to the previous state
    });

    // Handle t he back gesture on mobile devices (browser back button or swipe)
    window.addEventListener('popstate', () => {
        console.log("Back gesture detected. Exiting AR...");
        exitAR();
    });

    // Function to handle exiting AR session and returning to the previous state
    function exitAR() {
        if (session) {
            session.end();  // End the AR session
        }
        // Remove the overlay and canvas from the DOM
        document.body.removeChild(overlay);
        document.body.removeChild(canvas);
        xrButton.style.display = "block";  // Show the enter AR button again
    }

    // Setup the scene, camera, and renderer for the XR session
    const scene = setupScene();
    const camera = setupCamera();
    const renderer = setupRenderer(canvas, gl);
    const session = await setupXRSession(gl);  // Setup XR session
    const { referenceSpace, viewerSpace, hitTestSource } = await setupXRSpaces(session);  // Setup XR reference spaces
    
    const loader = new THREE.GLTFLoader();  // Loader for 3D models
    
    // Load reticle model
    let reticle;
    loader.load('assets/models/reticle.gltf',
        function (gltf) {
            reticle = gltf.scene;
            reticle.visible = false;  // Initially hide reticle
            scene.add(reticle);
        }, 
    );
    
    // Load flower (sunflower) model
    let flower;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf",
      function(gltf) {
          flower = gltf.scene;
      }
    );
    
    // Load skeleton model
    let skeleton;
    loader.load("assets/models/human_skeleton_1.6metres.glb", 
        function(gltf) {
            skeleton = gltf.scene;
    });

    // Default selected model is Skeleton
    let selectedModel = "skeleton";

    // Ensure spawn button visibility updates based on reticle visibility
    function updateSpawnButtonVisibility() {
      spawnButton.style.display = reticle && reticle.visible ? "block" : "none";
    }

    // XR frame update loop
    function onXRFrame(time, frame) {
      session.requestAnimationFrame(onXRFrame);  // Request next frame for XR session
      gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

      const pose = frame.getViewerPose(referenceSpace);  // Get the viewer's pose (camera position)
      if (pose) {
        const view = pose.views[0];
        const viewport = session.renderState.baseLayer.getViewport(view);
        renderer.setSize(viewport.width, viewport.height);
        camera.matrix.fromArray(view.transform.matrix);
        camera.projectionMatrix.fromArray(view.projectionMatrix);
        camera.updateMatrixWorld(true);

        const hitTestResults = frame.getHitTestResults(hitTestSource);  // Get hit test results for placing models
        if (hitTestResults.length > 0) {
          const hitPose = hitTestResults[0].getPose(referenceSpace);
          reticle.visible = true;
          reticle.position.set(
            hitPose.transform.position.x,
            hitPose.transform.position.y,
            hitPose.transform.position.z
          );
          reticle.updateMatrixWorld(true);  // Update reticle position in the scene
          updateSpawnButtonVisibility();  // Update visibility of spawn button
        }
        renderer.render(scene, camera);  // Render the scene
      }
    }
    session.requestAnimationFrame(onXRFrame);  // Start the XR frame loop
}

// Function to check if immersive AR is supported
function checkSupportedState() {
  navigator.xr.isSessionSupported("immersive-ar").then(supported => {
    if (supported) {
      xrButton.innerHTML = "Enter AR";  // Change button text if AR is supported
    } else {
      xrButton.innerHTML = "AR not found";  // Indicate AR is not supported
    }
    xrButton.disabled = !supported;  // Disable button if AR is not supported
  });
}

// Setup basic scene with lighting and ground
function setupScene() {
  const scene = new THREE.Scene();

  // Add directional light to the scene
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 15, 10);
  directionalLight.castShadow = true;  // Enable shadow casting for the light
  scene.add(directionalLight);

  // Add ground plane to the scene with shadow receiving
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.5 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  return scene;
}

// Setup camera for XR rendering
function setupCamera() {
  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;  // Prevent automatic matrix updates
  return camera;
}

// Setup renderer for WebGL and XR compatibility
function setupRenderer(canvas, gl) {
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true });
  renderer.autoClear = false;  // Prevent automatic clearing of the canvas
  return renderer;
}

// Setup XR session for immersive AR
async function setupXRSession(gl) {
  const session = await navigator.xr.requestSession("immersive-ar", 
    { 
      requiredFeatures: ["hit-test", "dom-overlay"],  // Enable hit test and DOM overlay features
      optionalFeatures: [],
      domOverlay: 
      { 
        root: document.getElementById("overlay")  // Link the DOM overlay to the overlay div
      } 
    }
  );
  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
  return session;
}

// Setup XR reference spaces and hit test source
async function setupXRSpaces(session) {
  const referenceSpace = await session.requestReferenceSpace("local");
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  return { referenceSpace, viewerSpace, hitTestSource };
}


