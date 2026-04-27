const state = {
    status: 'idle',
    vacuumPump: false,
    perfusionPump: false,
    v1: false,
    v2: false,
    v3: false,
    vacuum: 0,
    flow: 0,
    temperature: 25,
    pressure: 0,
    progress: 0,
    alarms: [],
    alarmCount: 0,
    startTime: null,
    elapsed: 0,
    phase: '待机',
    deviceLastStatus: {},
    faultyDevices: {},
    // GZJ设备状态（灌注机1-4）
    gzjPhase: '停机',  // 停机/运行中/暂停
    gzjFaultyDevices: {},
    // CZK设备状态（抽真空机1-24）
    czkPhase: '停机',  // 停机/运行中/暂停
    czkFaultyDevices: {},
    // 工序进度
    vacuumProgress: 0,      // 抽真空工序进度 (0-100)
    perfusionProgress: 0,   // 灌注工序进度 (0-100)
    // 工艺统计
    stability: 98.5,        // 工艺稳定性 (%)
    successRate: 96.2,      // 成功率 (%)
    isRunning: false        // 系统是否正在运行
};

function createParticles() {
    const field = document.getElementById('particleField');
    for (let i = 0; i < 25; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 10 + 's';
        p.style.animationDuration = (8 + Math.random() * 6) + 's';
        field.appendChild(p);
    }
}

// 全局变量，方便调试
window.scene = null;
window.camera = null;
window.renderer = null;
window.controls = null;
window.models = {}; // 存储所有设备模型
window.mainModel = null; // 主模型 (model.glb)
window.deviceStatusContainer = null; // 设备状态标签容器
window.deviceStatusLabels = {}; // 存储所有设备状态标签
window.deviceStatusLabelElements = {}; // 存储设备状态标签DOM元素
let mixer, animationId;
let animationActions = []; // 存储动画动作对象
let isAnimationPlaying = false; // 动画播放状态
let clock = new THREE.Clock();
let frameCount = 0, lastFps = 0;

function init() {
    // 检查 Three.js 是否加载成功
    if (typeof THREE === 'undefined') {
        console.error('Three.js 库未加载，请检查网络连接');
        document.getElementById('canvas-container').innerHTML = 
            '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:#ef4444;font-size:14px;">' +
            'Three.js 加载失败，请刷新页面重试</div>';
        return;
    }
    
    // 检查 GLTFLoader 是否加载成功
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader 未加载，请检查网络连接');
        document.getElementById('canvas-container').innerHTML = 
            '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:#ef4444;font-size:14px;">' +
            'GLTFLoader 加载失败，请刷新页面重试</div>';
        return;
    }
    
    const container = document.getElementById('canvas-container');
    const w = container.clientWidth, h = container.clientHeight;

    // 初始化全局变量
    window.scene = new THREE.Scene();
    window.scene.background = new THREE.Color(0x020408);
    window.scene.fog = new THREE.FogExp2(0x020408, 0.012);

    window.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    window.camera.position.set(17.68, 10.67, 17.95);
    window.camera.rotation.set(-33.5 * Math.PI / 180, 44.9 * Math.PI / 180, 25.0 * Math.PI / 180);
    window.camera.lookAt(0, 0, 0);

    window.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    window.renderer.setSize(w, h);
    window.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    window.renderer.shadowMap.enabled = true;
    window.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    window.renderer.toneMappingExposure = 1.3;
    
    // 设置canvas的z-index，确保它在浮动面板下面
    const canvas = window.renderer.domElement;
    canvas.style.position = 'relative';
    canvas.style.zIndex = '10';
    
    container.appendChild(canvas);


    // 检查 OrbitControls 是否加载成功
    if (typeof THREE.OrbitControls === 'undefined') {
        // 创建一个简单的备用控制对象
        window.controls = {
            update: function() {},
            enableDamping: false,
            autoRotate: false
        };
    } else {
        window.controls = new THREE.OrbitControls(camera, renderer.domElement);
        window.controls.enableDamping = true;
        window.controls.dampingFactor = 0.05;
        window.controls.minDistance = 2;
        window.controls.maxDistance = 35; // 限制最远视角
        window.controls.autoRotate = false; // 初始状态关闭自动旋转
        window.controls.autoRotateSpeed = 0.4;
    }

    // 绑定自动旋转控制按钮事件
    function setupAutoRotateControl() {
        const rotateBtn = document.getElementById('toggleRotateBtn');
        
        if (rotateBtn) {
            rotateBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                if (window.controls) {
                    window.controls.autoRotate = !window.controls.autoRotate;
                    
                    if (window.controls.autoRotate) {
                        rotateBtn.classList.add('active');
                        rotateBtn.innerHTML = '<span class="rotate-icon">🔄</span><span>停止旋转</span>';
                    } else {
                        rotateBtn.classList.remove('active');
                        rotateBtn.innerHTML = '<span class="rotate-icon">🔄</span><span>开始旋转</span>';
                    }
                }
            });
        } else {
            // 自动旋转控制按钮未找到
        }
    }

    // 设置自动旋转控制
    setupAutoRotateControl();

    // 基础环境光 + 主光源
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    // 添加主方向光，提供立体感和阴影
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    scene.add(mainLight);

    // 添加补光，减少暗部
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // 创建流光效果的网格地面
    const gridSize = 1000;
    const gridDivisions = 400;
    
    // 使用自定义着色器创建流光网格
    const gridGeometry = new THREE.BufferGeometry();
    const gridPositions = [];
    const gridColors = [];
    const gridLineIndices = [];
    
    const step = gridSize / gridDivisions;
    const halfSize = gridSize / 2;
    let lineIndex = 0;
    
    // 生成网格线顶点
    for (let i = 0; i <= gridDivisions; i++) {
        const pos = -halfSize + i * step;
        
        // X方向线
        gridPositions.push(-halfSize, 0, pos);
        gridPositions.push(halfSize, 0, pos);
        gridLineIndices.push(lineIndex, lineIndex + 1);
        lineIndex += 2;
        
        // Z方向线
        gridPositions.push(pos, 0, -halfSize);
        gridPositions.push(pos, 0, halfSize);
        gridLineIndices.push(lineIndex, lineIndex + 1);
        lineIndex += 2;
    }
    
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
    gridGeometry.setAttribute('lineIndex', new THREE.Float32BufferAttribute(
        gridLineIndices.flatMap(idx => [idx, idx]), 1
    ));
    
    // 自定义着色器材质 - 流光效果 + 距离渐变淡出
    const gridMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0x00d4ff) },
            glowColor: { value: new THREE.Color(0xffffff) },
            fadeStart: { value: 60.0 },
            fadeEnd: { value: 100.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            varying float vPosition;
            varying float vDistance;
            attribute float lineIndex;
            uniform float time;
            
            void main() {
                vUv = uv;
                vPosition = position.x + position.z;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vDistance = -mvPosition.z;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 color;
            uniform vec3 glowColor;
            uniform float fadeStart;
            uniform float fadeEnd;
            varying float vPosition;
            varying float vDistance;
            
            void main() {
                // 距离渐变淡出效果
                float fadeFactor = 1.0 - smoothstep(fadeStart, fadeEnd, vDistance);
                
                // 创建流动的光波效果
                float wave1 = sin(vPosition * 0.5 + time * 2.0) * 0.5 + 0.5;
                float wave2 = sin(vPosition * 0.3 - time * 1.5) * 0.5 + 0.5;
                float wave3 = sin(vPosition * 0.8 + time * 3.0) * 0.5 + 0.5;
                
                // 组合多个波形
                float glow = wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2;
                glow = pow(glow, 2.0);
                
                // 基础颜色 + 流光
                vec3 finalColor = mix(color, glowColor, glow * 0.8);
                float alpha = (0.3 + glow * 0.7) * fadeFactor;
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
    grid.position.y = 0;
    scene.add(grid);
    
    // 保存材质引用用于动画更新
    window.gridMaterial = gridMaterial;
    
    // 添加地面平面 - 带距离渐变淡出效果
    const planeGeometry = new THREE.PlaneGeometry(gridSize, gridSize);
    const planeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(0x020810) },
            fadeStart: { value: 60.0 },
            fadeEnd: { value: 100.0 }
        },
        vertexShader: `
            varying float vDistance;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vDistance = -mvPosition.z;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform float fadeStart;
            uniform float fadeEnd;
            varying float vDistance;
            void main() {
                float fadeFactor = 1.0 - smoothstep(fadeStart, fadeEnd, vDistance);
                float alpha = 0.6 * fadeFactor;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.01;
    scene.add(plane);

    loadModel();

    window.addEventListener('resize', onResize);
    
    // 初始调整大小，确保canvas尺寸正确
    setTimeout(onResize, 100);
    
    createParticles();
    
    // 添加设备交互
    setupDeviceInteraction();
    
    animate();

    document.getElementById('btnStart').addEventListener('click', startPerfuse);
    document.getElementById('btnPause').addEventListener('click', pausePerfuse);
    document.getElementById('btnReset').addEventListener('click', reset);

    setInterval(tickClock, 1000);
    tickClock();
}

function loadModel() {
    // 检查 GLTFLoader 是否可用
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader 加载失败，使用备用模型');
        return;
    }

    const loader = new THREE.GLTFLoader();
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
    loader.setDRACOLoader(dracoLoader);

    // 加载主模型
    loader.load(
        './models/model.glb',
        function (gltf) {
            mainModel = gltf.scene;
            mainModel.scale.set(1, 1, 1);
            mainModel.position.set(0, 0, 0);
            scene.add(mainModel);
            
            // 设置动画
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(mainModel);
                animationActions = [];
                
                gltf.animations.forEach(function(clip) {
                    const action = mixer.clipAction(clip);
                    action.play();
                    action.paused = true;
                    animationActions.push(action);
                });
                
                // 设置初始时间为0
                mixer.time = 0;
                window.modelMixer = mixer;
                window.modelAnimations = animationActions;
            }
            
            // 更新加载动画文本
            document.getElementById('modelLoading').innerHTML = '<div class="loading-text">加载设备模型中...</div>';
            
            // 加载所有设备模型
            loadAllDeviceModels();
        },
        function (xhr) {
            // 进度回调
        },
        function (error) {
            console.error('加载模型时出错:', error);
            document.getElementById('modelLoading').innerHTML = 
                '<div class="loading-text" style="color: #ef4444;">模型加载失败</div>';
        }
    );
}

function loadAllDeviceModels() {
    // 创建模型加载队列
    const modelQueue = [];
    
    // 添加抽真空机模型到队列
    for (let i = 1; i <= 24; i++) {
        modelQueue.push({
            name: `CZK_${i}`,
            path: `./models/CZK_${i}.glb`
        });
    }
    
    // 添加灌注机模型到队列
    for (let i = 1; i <= 4; i++) {
        modelQueue.push({
            name: `GZJ_${i}`,
            path: `./models/GZJ_${i}.glb`
        });
    }
    
    // 串行加载模型
    loadModelQueue(modelQueue, 0);
}

function loadModelQueue(queue, index) {
    if (index >= queue.length) {
        setTimeout(() => {
            initDeviceStatusLabels();
            updateDeviceStatusStatistics(); // 初始加载时统计设备状态
        }, 500);
        return;
    }
    
    const model = queue[index];
    
    loadDeviceModel(model.name, model.path, () => {
        // 模型加载完成后，加载下一个
        setTimeout(() => {
            loadModelQueue(queue, index + 1);
        }, 100); // 小延迟避免资源竞争
    });
}

function loadDeviceModel(name, path, callback) {
    // 检查路径是否正确
    if (!path) {
        if (callback) callback();
        return;
    }
    
    // 检查 THREE.GLTFLoader 是否存在
    if (typeof THREE.GLTFLoader === 'undefined') {
        if (callback) callback();
        return;
    }
    
    const loader = new THREE.GLTFLoader();
    
    // 添加 DRACOLoader 支持
    if (typeof THREE.DRACOLoader !== 'undefined') {
        const dracoLoader = new THREE.DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
        loader.setDRACOLoader(dracoLoader);
    } else {
        // DRACOLoader 未定义，模型可能无法加载
    }
    
    // 检查loader是否创建成功
    if (!loader) {
        if (callback) callback();
        return;
    }
    
    // 尝试直接访问模型文件，测试路径是否正确
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', path);
    xhr.onload = function() {
        if (xhr.status === 200) {
            // 模型文件存在
        } else {
            // 模型文件不存在
        }
    };
    xhr.onerror = function() {
        // 无法访问模型文件
    };
    xhr.send();
    
    loader.load(
        path,
        function (gltf) {
            // 检查gltf对象是否有效
            if (!gltf || !gltf.scene) {
                console.error(`模型 ${name} 加载成功但场景无效`);
                if (callback) callback();
                return;
            }
            
            const model = gltf.scene;
            
            // 保持与主模型一致的缩放比例
            model.scale.set(1, 1, 1);
            
            // 保留模型在GLB文件中定义的原位置
            
            // 设置模型为可点击
            model.userData.clickable = true;
            model.userData.deviceId = name;
            
            // 递归设置所有子对象为可点击
            model.traverse(function(child) {
                if (child.isMesh) {
                    child.userData.clickable = true;
                    child.userData.deviceId = name;
                }
            });
            
            // 添加模型到场景
            scene.add(model);
            models[name] = model;
            
            // 为模型创建状态标签锚点
            const anchor = new THREE.Object3D();
            anchor.name = 'statusAnchor';
            
            // 计算模型边界框，确定锚点位置
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            // 将锚点放置在模型顶部上方
            anchor.position.set(center.x, box.max.y + 0.3, center.z);
            anchor.userData.deviceId = name;
            
            model.add(anchor);
            model.userData.statusAnchor = anchor;
            
            // 为模型添加发光效果
            addGlowEffect(model);
            
            // 更新设备计数
            updateDeviceCount();
            
            // 调用回调函数
            if (callback) callback();
        },
        function (xhr) {
            if (xhr.lengthComputable) {
                // 加载进度
            }
        },
        function (error) {
            // 即使出错也要调用回调，确保加载队列继续
            if (callback) callback();
        }
    );
}

function addGlowEffect(model) {
    let meshCount = 0;
    model.traverse((child) => {
        if (child.isMesh) {
            meshCount++;
            if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material;
            }
            
            const hologramMaterial = new THREE.MeshBasicMaterial({
                color: 0x22d3ee,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            child.userData.hologramMaterial = hologramMaterial;
        }
    });
}

function onResize() {
    const container = document.getElementById('canvas-container');
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

function animate() {
    animationId = requestAnimationFrame(animate);
    
    // 更新时钟
    const delta = clock.getDelta();
    frameCount++;
    
    // 每100帧更新一次FPS显示
    if (frameCount % 100 === 0) {
        const currentFps = Math.round(1 / delta);
        document.getElementById('fpsDisplay').textContent = currentFps;
        lastFps = currentFps;
    }
    
    // 每6帧更新一次工艺参数和进度条（约100ms间隔，60fps/6=10次/秒）
    if (frameCount % 6 === 0) {
        updateProcessParams();
    }
    
    // 更新网格材质的时间 uniforms
    if (window.gridMaterial) {
        window.gridMaterial.uniforms.time.value += delta;
    }
    
    // 更新模型动画
    if (mixer) {
        mixer.update(delta);
    }
    
    // 更新控制器
    window.controls.update();
    
    // 更新设备状态标签位置
    if (window.deviceStatusLabels) {
        updateDeviceStatusLabels();
        updateDeviceStatusImages();
    }
    
    // 更新设备数据面板（如果已打开）
    if (window.updateDeviceDataPanel) {
        window.updateDeviceDataPanel();
    }
    
    // 渲染场景
    renderer.render(scene, camera);
    
    // 更新相机位置显示
    const pos = camera.position;
    document.getElementById('cameraPos').textContent = 
        `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    
    // 在控制台记录相机位置和旋转角度
    if (frameCount % 60 === 0) { // 每60帧输出一次（约每秒1次）
        const rotation = camera.rotation;
        console.log(`相机信息 - 位置: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) | 旋转: X=${(rotation.x * 180 / Math.PI).toFixed(1)}° Y=${(rotation.y * 180 / Math.PI).toFixed(1)}° Z=${(rotation.z * 180 / Math.PI).toFixed(1)}°`);
    }
}

function setupDeviceInteraction() {
    const canvas = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredObject = null;
    let labelElement = null;
    
    // 鼠标移动事件
    canvas.addEventListener('mousemove', function(event) {
        // 计算鼠标在屏幕上的位置
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // 更新射线
        raycaster.setFromCamera(mouse, camera);
        
        // 获取所有设备模型
        const deviceModels = Object.values(window.models || {});
        
        // 计算射线与所有可点击对象的交点
        // 直接检测场景中的所有对象，然后筛选出设备模型
        const allIntersects = raycaster.intersectObjects(scene.children, true);
        
        // 筛选出设备模型
        const deviceIntersects = [];
        for (let i = 0; i < allIntersects.length; i++) {
            const intersect = allIntersects[i];
            const object = intersect.object;
            
            // 检查对象或其父对象是否是设备模型
            let current = object;
            while (current) {
                if (current.userData && current.userData.clickable && current.userData.deviceId) {
                    deviceIntersects.push({ ...intersect, deviceObject: current });
                    break;
                }
                current = current.parent;
            }
        }
        
        // 检查是否有交点
        let currentHoveredObject = null;
        let currentIntersect = null;
        
        // 只有当射线真正命中设备时才触发悬停
        if (deviceIntersects.length > 0) {
            const firstDevice = deviceIntersects[0];
            currentHoveredObject = firstDevice.deviceObject;
            currentIntersect = firstDevice;
        }
        
        // 只有当悬停对象发生变化时才处理
        if (hoveredObject !== currentHoveredObject) {
            // 恢复之前悬停对象的材质
            if (hoveredObject) {
                restoreHoverOriginalMaterials(hoveredObject);
                // 清除悬停材质标记
                hoveredObject.userData.hoverOriginalMaterial = null;
            }
            removeLabel();
            
            // 为当前悬停的对象添加全息透明效果和标签
            if (currentHoveredObject) {
                // 检查是否是故障设备，如果是则跳过悬停效果
                if (!currentHoveredObject.userData.isFaulty) {
                    // 保存原始材质（如果还没保存）
                    if (!currentHoveredObject.userData.hoverOriginalMaterial) {
                        // 保存真正的原始材质
                        const originalMaterials = [];
                        currentHoveredObject.traverse(function(child) {
                            if (child.isMesh) {
                                // 使用原始材质而不是当前材质
                                const originalMaterial = child.userData.originalMaterial || child.material;
                                originalMaterials.push({ child: child, material: originalMaterial });
                            }
                        });
                        currentHoveredObject.userData.hoverOriginalMaterial = originalMaterials;
                    }
                    
                    // 创建全息透明材质
                    const hologramMaterial = new THREE.MeshPhongMaterial({
                        color: 0x00d5ff,
                        transparent: true,
                        opacity: 0.6,
                        side: THREE.DoubleSide,
                        shininess: 100,
                        specular: 0xffffff
                    });
                    
                    // 应用到所有子对象
                    applyMaterialToChildren(currentHoveredObject, hologramMaterial);
                }
                
                // 添加标签
                if (currentIntersect) {
                    addLabel(currentIntersect, currentHoveredObject);
                }
            }
            
            // 更新悬停对象
            hoveredObject = currentHoveredObject;
            
            // 设置鼠标指针样式
            canvas.style.cursor = currentHoveredObject ? 'pointer' : 'default';
        }
    });
    
    // 鼠标离开事件
    canvas.addEventListener('mouseleave', function() {
        if (hoveredObject) {
            // 恢复材质
            if (hoveredObject.userData.hoverOriginalMaterial) {
                restoreHoverOriginalMaterials(hoveredObject);
                hoveredObject.userData.hoverOriginalMaterial = null;
            }
            removeLabel();
            hoveredObject = null;
        }
        canvas.style.cursor = 'default';
    });
    
    // 点击事件
    canvas.addEventListener('click', function(event) {
        // 计算鼠标坐标
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // 更新射线
        raycaster.setFromCamera(mouse, camera);
        
        // 获取所有设备模型
        const deviceModels = Object.values(window.models || {});
        
        // 检测射线与设备模型的交点
        const intersects = raycaster.intersectObjects(deviceModels, true);
        
        // 查找第一个命中的设备模型
        for (let i = 0; i < intersects.length; i++) {
            const intersect = intersects[i];
            const object = intersect.object;
            
            if (object.userData.clickable && object.userData.deviceId) {
                showDeviceDataPanel(object.userData.deviceId);
                return;
            }
        }
    });
    
    function showDeviceDataPanel(deviceId) {
        removeDeviceDataPanel();
        
        const model = window.models[deviceId];
        let panelX = 200, panelY = 100;
        
        if (model && model.userData.statusAnchor) {
            const anchor = model.userData.statusAnchor;
            const anchorWorldPos = new THREE.Vector3();
            anchor.getWorldPosition(anchorWorldPos);
            anchorWorldPos.project(camera);
            
            const canvasRect = renderer.domElement.getBoundingClientRect();
            panelX = (anchorWorldPos.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
            panelY = (-anchorWorldPos.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top - 20;
        }
        
        const panel = document.createElement('div');
        panel.className = 'device-data-panel';
        panel.style.position = 'fixed';
        panel.style.left = (panelX + 15) + 'px';
        panel.style.top = (panelY - 80) + 'px';
        panel.style.backgroundColor = '#1e2330';
        panel.style.borderRadius = '14px';
        panel.style.padding = '0';
        panel.style.minWidth = '220px';
        panel.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.05)';
        panel.style.border = '1px solid rgba(60, 70, 90, 0.5)';
        panel.style.zIndex = '2000';
        panel.style.pointerEvents = 'auto';
        panel.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        panel.style.overflow = 'hidden';
        panel.style.opacity = '0.96';
        
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.padding = '14px 18px';
        header.style.backgroundColor = 'rgba(40, 48, 65, 0.6)';
        header.style.borderBottom = '1px solid rgba(60, 70, 90, 0.4)';
        
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.gap = '10px';
        
        const statusDot = document.createElement('div');
        statusDot.className = 'panel-status-dot';
        statusDot.style.width = '10px';
        statusDot.style.height = '10px';
        statusDot.style.borderRadius = '50%';
        
        let isFaulty = state.faultyDevices && state.faultyDevices[deviceId];
        if (isFaulty) {
            statusDot.style.backgroundColor = '#ef4444';
            statusDot.style.boxShadow = '0 0 6px rgba(239, 68, 68, 0.6)';
        } else if (state.phase === '灌注' || state.phase === '抽真空') {
            statusDot.style.backgroundColor = '#22c55e';
            statusDot.style.boxShadow = '0 0 6px rgba(34, 197, 94, 0.6)';
        } else if (state.phase === '暂停') {
            statusDot.style.backgroundColor = '#f59e0b';
            statusDot.style.boxShadow = '0 0 6px rgba(245, 158, 11, 0.6)';
        } else {
            statusDot.style.backgroundColor = '#6b7280';
            statusDot.style.boxShadow = 'none';
        }
        
        const title = document.createElement('span');
        title.textContent = getDeviceDisplayName(deviceId);
        title.style.color = '#e5e7eb';
        title.style.fontSize = '14px';
        title.style.fontWeight = '500';
        title.style.letterSpacing = '0.3px';
        
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.color = '#6b7280';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.padding = '2px 8px';
        closeBtn.style.lineHeight = '1';
        closeBtn.onmouseover = function() { this.style.color = '#e5e7eb'; };
        closeBtn.onmouseout = function() { this.style.color = '#6b7280'; };
        closeBtn.onclick = function(e) { e.stopPropagation(); removeDeviceDataPanel(); };
        
        titleContainer.appendChild(statusDot);
        titleContainer.appendChild(title);
        header.appendChild(titleContainer);
        header.appendChild(closeBtn);
        panel.appendChild(header);
        
        let statusText = '停机';
        let statusColor = '#6b7280';
        if (isFaulty) {
            statusText = '故障';
            statusColor = '#ef4444';
        } else if (state.phase === '灌注' || state.phase === '抽真空') {
            statusText = '运行中';
            statusColor = '#22c55e';
        } else if (state.phase === '暂停') {
            statusText = '待机';
            statusColor = '#f59e0b';
        }
        
        const vacuumValue = (Math.random() * 400 + 100).toFixed(2);
        const pressureValue = (Math.random() * 900 + 500).toFixed(2);
        const tempValue = (Math.random() * 80 + 250).toFixed(1);
        
        const paramItems = [
            { label: '真空度', value: vacuumValue + ' Pa', color: '#00d5ff' },
            { label: '压力', value: pressureValue + ' MPa', color: '#00d5ff' },
            { label: '温度', value: tempValue + ' ℃', color: '#00d5ff' },
            { label: '状态', value: statusText, color: statusColor }
        ];
        
        paramItems.forEach(function(item, index) {
            const row = document.createElement('div');
            row.className = 'data-row';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '12px 18px';
            
            if (index < paramItems.length - 1) {
                row.style.borderBottom = '1px solid rgba(60, 70, 90, 0.3)';
            }
            
            const label = document.createElement('span');
            label.textContent = item.label;
            label.style.color = '#9ca3af';
            label.style.fontSize = '13px';
            label.style.fontWeight = '400';
            
            const value = document.createElement('span');
            value.className = 'data-value';
            value.textContent = item.value;
            value.style.color = item.color;
            value.style.fontSize = '13px';
            value.style.fontWeight = '500';
            
            row.appendChild(label);
            row.appendChild(value);
            panel.appendChild(row);
        });
        
        // 如果是故障设备，添加处理故障按钮
        if (isFaulty) {
            const buttonRow = document.createElement('div');
            buttonRow.style.padding = '16px 18px';
            buttonRow.style.borderTop = '1px solid rgba(60, 70, 90, 0.4)';
            
            const fixButton = document.createElement('button');
            fixButton.textContent = '处理故障';
            fixButton.style.width = '100%';
            fixButton.style.padding = '12px 24px';
            fixButton.style.border = '1px solid rgba(74, 222, 128, 0.3)';
            fixButton.style.borderRadius = '8px';
            fixButton.style.background = 'linear-gradient(135deg, rgba(31, 41, 55, 0.9) 0%, rgba(17, 24, 39, 0.7) 100%)';
            fixButton.style.color = '#4ade80';
            fixButton.style.fontFamily = "'Orbitron', sans-serif";
            fixButton.style.fontSize = '11px';
            fixButton.style.fontWeight = '600';
            fixButton.style.letterSpacing = '0.5px';
            fixButton.style.textTransform = 'uppercase';
            fixButton.style.cursor = 'pointer';
            fixButton.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            fixButton.style.position = 'relative';
            fixButton.style.overflow = 'hidden';
            
            // 添加悬停光晕效果
            fixButton.onmouseover = function() {
                this.style.background = 'linear-gradient(135deg, rgba(74, 222, 128, 0.15) 0%, rgba(21, 128, 61, 0.1) 100%)';
                this.style.borderColor = '#4ade80';
                this.style.color = '#4ade80';
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 0 25px rgba(74, 222, 128, 0.35), inset 0 0 25px rgba(74, 222, 128, 0.1)';
            };
            fixButton.onmouseout = function() {
                this.style.background = 'linear-gradient(135deg, rgba(31, 41, 55, 0.9) 0%, rgba(17, 24, 39, 0.7) 100%)';
                this.style.borderColor = 'rgba(74, 222, 128, 0.3)';
                this.style.color = '#4ade80';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            };
            fixButton.onmousedown = function() {
                this.style.transform = 'scale(0.97) translateY(0)';
            };
            fixButton.onmouseup = function() {
                this.style.transform = 'translateY(-2px)';
            };
            fixButton.onclick = function(e) {
                e.stopPropagation();
                handleFaultResolution(deviceId);
            };
            
            buttonRow.appendChild(fixButton);
            panel.appendChild(buttonRow);
        }
        
        document.body.appendChild(panel);
        window.deviceDataPanel = panel;
        window.deviceDataPanelDeviceId = deviceId;
    }
    
    function updateDeviceDataPanel() {
        if (!window.deviceDataPanel || !window.deviceDataPanelDeviceId) return;
        
        const deviceId = window.deviceDataPanelDeviceId;
        const panel = window.deviceDataPanel;
        
        // 判断设备类型
        const isGZJ = deviceId.startsWith('GZJ_');
        const isCZK = deviceId.startsWith('CZK_');
        
        // 检查是否为故障设备（包括GZJ和CZK的故障）
        const isFaulty = (isGZJ && state.gzjFaultyDevices[deviceId]) ||
                        (isCZK && state.czkFaultyDevices[deviceId]) ||
                        state.faultyDevices[deviceId];
        
        let statusText = '停机';
        let statusColor = '#6b7280';
        let isRunning = false;
        
        if (isFaulty) {
            statusText = '故障';
            statusColor = '#ef4444';
        } else if (isGZJ && state.gzjPhase === '运行中') {
            statusText = '运行中';
            statusColor = '#22c55e';
            isRunning = true;
        } else if (isCZK && state.czkPhase === '运行中') {
            statusText = '运行中';
            statusColor = '#22c55e';
            isRunning = true;
        } else if ((isGZJ && state.gzjPhase === '暂停') || (isCZK && state.czkPhase === '暂停')) {
            statusText = '待机';
            statusColor = '#f59e0b';
        }
        
        const headerStatusDot = panel.querySelector('.panel-status-dot');
        if (headerStatusDot) {
            headerStatusDot.style.backgroundColor = statusColor;
            if (isFaulty || isRunning) {
                const hexToRgba = function(hex, alpha) {
                    const r = parseInt(hex.slice(1,3), 16);
                    const g = parseInt(hex.slice(3,5), 16);
                    const b = parseInt(hex.slice(5,7), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                headerStatusDot.style.boxShadow = `0 0 6px ${hexToRgba(statusColor, 0.6)}`;
            } else {
                headerStatusDot.style.boxShadow = 'none';
            }
        }
        
        const rows = panel.querySelectorAll('.data-row');
        if (rows.length >= 4) {
            const vacuumValue = (Math.random() * 400 + 100).toFixed(2);
            const pressureValue = (Math.random() * 900 + 500).toFixed(2);
            const tempValue = (Math.random() * 80 + 250).toFixed(1);
            
            const values = [vacuumValue + ' Pa', pressureValue + ' MPa', tempValue + ' ℃', statusText];
            const colors = ['#00d5ff', '#00d5ff', '#00d5ff', statusColor];
            
            for (let i = 0; i < rows.length; i++) {
                const valueEl = rows[i].querySelector('.data-value');
                if (valueEl) {
                    valueEl.textContent = values[i];
                    valueEl.style.color = colors[i];
                }
            }
        }
    }
    
    function removeDeviceDataPanel() {
        if (window.deviceDataPanel && document.body.contains(window.deviceDataPanel)) {
            try {
                document.body.removeChild(window.deviceDataPanel);
            } catch (error) {
                // 移除数据面板时出错
            }
            window.deviceDataPanel = null;
            window.deviceDataPanelDeviceId = null;
        }
    }
    
    function handleFaultResolution(deviceId) {
        // 判断设备类型
        const isGZJ = deviceId.startsWith('GZJ_');
        const isCZK = deviceId.startsWith('CZK_');
        
        // 检查设备是否为故障状态（包括全局、GZJ、CZK）
        const isFaulty = state.faultyDevices[deviceId] ||
                         (isGZJ && state.gzjFaultyDevices[deviceId]) ||
                         (isCZK && state.czkFaultyDevices[deviceId]);
        
        if (!isFaulty) {
            return; // 设备不是故障状态
        }
        
        // 1. 移除故障状态（从所有相关位置）
        delete state.faultyDevices[deviceId];
        if (isGZJ) {
            delete state.gzjFaultyDevices[deviceId];
        } else if (isCZK) {
            delete state.czkFaultyDevices[deviceId];
        }
        
        // 2. 在报警记录中添加处理完成记录（确保不重复）
        const resolutionMessage = `${getDeviceDisplayName(deviceId)} 故障已处理`;
        const existingResolution = state.alarms.find(alarm => 
            alarm.type === 'success' && alarm.message === resolutionMessage
        );
        
        if (!existingResolution) {
            const alarm = {
                type: 'success',
                message: resolutionMessage,
                time: new Date().toLocaleTimeString()
            };
            state.alarms.unshift(alarm);
            state.alarmCount++;
            
            // 限制报警数量
            if (state.alarms.length > 10) {
                state.alarms.pop();
            }
            
            // 更新报警显示
            updateAlarmDisplay();
        }
        
        // 3. 更新设备状态统计
        updateDeviceStatusStatistics();
        
        // 4. 更新3D场景中的设备状态标签图片
        if (window.deviceStatusLabels) {
            updateDeviceStatusImages();
        }
        
        // 5. 更新数据面板显示（如果当前打开的是该设备的面板）
        if (window.updateDeviceDataPanel) {
            window.updateDeviceDataPanel();
        }
    }
    
    window.handleFaultResolution = handleFaultResolution;
    
    function addLabel(intersect, object) {
        removeLabel();
        
        const deviceId = object.userData.deviceId;
        const isGZJ = deviceId.startsWith('GZJ_');
        const isCZK = deviceId.startsWith('CZK_');
        
        let statusColor = '#6b7280';
        let statusText = '停机';
        
        // 检查是否为故障设备
        const isFaulty = (isGZJ && state.gzjFaultyDevices[deviceId]) ||
                         (isCZK && state.czkFaultyDevices[deviceId]) ||
                         state.faultyDevices[deviceId];
        
        if (isFaulty) {
            statusColor = '#ef4444';
            statusText = '故障';
        } else if (isGZJ) {
            // GZJ设备（灌注机）：根据gzjPhase判断
            if (state.gzjPhase === '运行中') {
                statusColor = '#22c55e';
                statusText = '运行中';
            } else if (state.gzjPhase === '暂停') {
                statusColor = '#f59e0b';
                statusText = '待机';
            }
        } else if (isCZK) {
            // CZK设备（抽真空机）：根据czkPhase判断
            if (state.czkPhase === '运行中') {
                statusColor = '#22c55e';
                statusText = '运行中';
            } else if (state.czkPhase === '暂停') {
                statusColor = '#f59e0b';
                statusText = '待机';
            }
        }
        
        labelElement = document.createElement('div');
        labelElement.className = 'device-hover-label';
        labelElement.style.position = 'absolute';
        labelElement.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        labelElement.style.color = '#00d5ff';
        labelElement.style.padding = '10px 18px';
        labelElement.style.borderRadius = '6px';
        labelElement.style.fontSize = '14px';
        labelElement.style.fontFamily = 'Arial, sans-serif';
        labelElement.style.fontWeight = '500';
        labelElement.style.zIndex = '1000';
        labelElement.style.pointerEvents = 'none';
        labelElement.style.border = '1px solid ' + statusColor;
        labelElement.style.boxShadow = '0 0 12px ' + statusColor.replace(')', ', 0.4)').replace('rgb', 'rgba').replace('#', '');
        labelElement.style.transform = 'translate(-50%, -150%)';
        labelElement.style.whiteSpace = 'nowrap';
        labelElement.style.display = 'flex';
        labelElement.style.alignItems = 'center';
        labelElement.style.gap = '10px';
        
        const statusDot = document.createElement('div');
        statusDot.style.width = '10px';
        statusDot.style.height = '10px';
        statusDot.style.borderRadius = '50%';
        statusDot.style.backgroundColor = statusColor;
        statusDot.style.boxShadow = '0 0 4px ' + statusColor;
        statusDot.style.flexShrink = '0';
        
        const textSpan = document.createElement('span');
        textSpan.textContent = getDeviceDisplayName(deviceId);
        
        const statusSpan = document.createElement('span');
        statusSpan.textContent = '[' + statusText + ']';
        statusSpan.style.color = statusColor;
        statusSpan.style.marginLeft = '8px';
        
        labelElement.appendChild(statusDot);
        labelElement.appendChild(textSpan);
        labelElement.appendChild(statusSpan);
        
        // 计算屏幕坐标
        const canvas = renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        // 将3D点转换为屏幕坐标
        const vector = new THREE.Vector3(intersect.point.x, intersect.point.y, intersect.point.z);
        vector.project(camera);
        
        const x = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
        const y = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;
        
        labelElement.style.left = x + 'px';
        labelElement.style.top = y + 'px';
        
        document.body.appendChild(labelElement);
    }
    
    function removeLabel() {
        if (labelElement && document.body.contains(labelElement)) {
            try {
                document.body.removeChild(labelElement);
            } catch (error) {
                // 移除标签时出错
            }
            labelElement = null;
        }
    }
    
    window.updateDeviceDataPanel = updateDeviceDataPanel;
    window.removeDeviceDataPanel = removeDeviceDataPanel;
}

function applyMaterialToChildren(object, material) {
    object.traverse(function(child) {
        if (child.isMesh) {
            child.material = material;
        }
    });
}

function saveHoverOriginalMaterials(object) {
    const originalMaterials = [];
    object.traverse(function(child) {
        if (child.isMesh) {
            originalMaterials.push({ child: child, material: child.material });
        }
    });
    object.userData.hoverOriginalMaterial = originalMaterials;
}

function restoreHoverOriginalMaterials(object) {
    const originalMaterials = object.userData.hoverOriginalMaterial;
    if (originalMaterials) {
        originalMaterials.forEach(function(item) {
            item.child.material = item.material;
        });
    }
}

function initDeviceStatusLabels() {
    const container = document.getElementById('canvas-container');
    if (!container) {
        console.log('initDeviceStatusLabels: canvas-container not found');
        return;
    }

    console.log('initDeviceStatusLabels called');
    console.log('window.models:', window.models);
    console.log('Object.keys(window.models):', Object.keys(window.models));

    window.deviceStatusContainer = document.createElement('div');
    window.deviceStatusContainer.id = 'device-status-container';
    window.deviceStatusContainer.style.position = 'absolute';
    window.deviceStatusContainer.style.top = '0';
    window.deviceStatusContainer.style.left = '0';
    window.deviceStatusContainer.style.width = '100%';
    window.deviceStatusContainer.style.height = '100%';
    window.deviceStatusContainer.style.pointerEvents = 'none';
    window.deviceStatusContainer.style.zIndex = '15';
    window.deviceStatusContainer.style.overflow = 'hidden';
    container.appendChild(window.deviceStatusContainer);


    const deviceModels = window.models;
    const deviceNames = Object.keys(deviceModels);
    console.log('initDeviceStatusLabels: deviceNames:', deviceNames);

    deviceNames.forEach(function(deviceId) {
        createDeviceStatusLabel(deviceId, deviceModels[deviceId]);
    });
}

function createDeviceStatusLabel(deviceId, deviceModel) {
    if (!window.deviceStatusContainer) {
        return;
    }
    
    const labelElement = document.createElement('div');
    labelElement.className = 'device-status-label';
    labelElement.style.position = 'absolute';
    labelElement.style.width = '36px';
    labelElement.style.height = '36px';
    labelElement.style.transform = 'translate(-50%, -100%)';
    labelElement.style.pointerEvents = 'none';
    labelElement.style.zIndex = '10';
    
    const img = document.createElement('img');
    img.src = './assets/images/stop.png';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    labelElement.appendChild(img);
    
    window.deviceStatusContainer.appendChild(labelElement);
    
    window.deviceStatusLabelElements[deviceId] = labelElement;
    window.deviceStatusLabels[deviceId] = {
        element: labelElement,
        img: img,
        model: deviceModel
    };
}

function updateDeviceStatusLabels() {
    if (!window.deviceStatusLabels) return;
    
    const canvas = renderer.domElement;
    const canvasRect = canvas.getBoundingClientRect();
    
    Object.keys(window.deviceStatusLabels).forEach(function(deviceId) {
        const labelInfo = window.deviceStatusLabels[deviceId];
        if (!labelInfo || !labelInfo.model) return;
        
        const labelElement = labelInfo.element;
        if (!labelElement) return;
        
        const model = labelInfo.model;
        const anchor = model.userData.statusAnchor;
        
        if (!anchor) {
            return;
        }
        
        // 获取锚点的世界坐标
        const anchorWorldPos = new THREE.Vector3();
        anchor.getWorldPosition(anchorWorldPos);
        
        // 将世界坐标投影到屏幕
        anchorWorldPos.project(camera);
        
        // 投影后的坐标范围是 [-1, 1]，需要映射到 [0, canvas尺寸]
        // 直接使用 canvas 的尺寸，因为标签容器相对于 canvas
        const x = (anchorWorldPos.x * 0.5 + 0.5) * canvasRect.width;
        const y = (-anchorWorldPos.y * 0.5 + 0.5) * canvasRect.height;
        
        labelElement.style.left = x + 'px';
        labelElement.style.top = y + 'px';
        
        if (anchorWorldPos.z > 1) {
            labelElement.style.display = 'none';
        } else {
            labelElement.style.display = 'block';
        }
    });
}

function updateDeviceStatusImages() {
    if (!window.deviceStatusLabels) {
        console.log('updateDeviceStatusImages: window.deviceStatusLabels is null or undefined');
        return;
    }

    console.log('updateDeviceStatusImages called - gzjPhase:', state.gzjPhase, 'czkPhase:', state.czkPhase);
    console.log('deviceStatusLabels keys:', Object.keys(window.deviceStatusLabels));

    Object.keys(window.deviceStatusLabels).forEach(function(deviceId) {
        const labelInfo = window.deviceStatusLabels[deviceId];
        if (!labelInfo || !labelInfo.img) {
            console.log('updateDeviceStatusImages: labelInfo or img is null for', deviceId);
            return;
        }

        let statusImage = './assets/images/stop.png';
        let statusColor = '#6b7280';

        // 判断设备类型
        const isGZJ = deviceId.startsWith('GZJ_');
        const isCZK = deviceId.startsWith('CZK_');

        // 检查是否为故障设备
        const isFaulty = (isGZJ && state.gzjFaultyDevices[deviceId]) ||
                         (isCZK && state.czkFaultyDevices[deviceId]) ||
                         state.faultyDevices[deviceId];

        if (isFaulty) {
            statusImage = './assets/images/error.png';
            statusColor = '#ef4444';
        } else if (isGZJ) {
            // GZJ设备（灌注机）：根据gzjPhase判断
            if (state.gzjPhase === '运行中') {
                statusImage = './assets/images/run.png';
                statusColor = '#22c55e';
            } else if (state.gzjPhase === '暂停') {
                statusImage = './assets/images/standby.png';
                statusColor = '#f59e0b';
            }
        } else if (isCZK) {
            // CZK设备（抽真空机）：根据czkPhase判断
            if (state.czkPhase === '运行中') {
                statusImage = './assets/images/run.png';
                statusColor = '#22c55e';
            } else if (state.czkPhase === '暂停') {
                statusImage = './assets/images/standby.png';
                statusColor = '#f59e0b';
            }
        }

        console.log('updateDeviceStatusImages:', deviceId, 'isGZJ:', isGZJ, 'isCZK:', isCZK, 'isFaulty:', isFaulty, 'setting src to:', statusImage);
        labelInfo.img.src = statusImage;
    });
}

function getDeviceTypeFromId(deviceId) {
    if (deviceId.toLowerCase().includes('czk') || deviceId.toLowerCase().includes('vacuum')) {
        return 'vacuumPump';
    } else if (deviceId.toLowerCase().includes('gzj') || deviceId.toLowerCase().includes('perfusion') || deviceId.toLowerCase().includes('灌注')) {
        return 'perfusionPump';
    } else if (deviceId.toLowerCase().startsWith('v')) {
        return 'valve';
    }
    return 'unknown';
}

function getDeviceDisplayName(deviceId) {
    const czkMatch = deviceId.match(/CZK_(\d+)/i);
    if (czkMatch) {
        return '抽真空机' + czkMatch[1];
    }
    
    const gzjMatch = deviceId.match(/GZJ_(\d+)/i);
    if (gzjMatch) {
        return '灌注机' + gzjMatch[1];
    }
    
    return deviceId;
}

function updateData() {
    // 更新设备状态
    updateDeviceStatus();
    
    // 更新工艺参数
    updateProcessParams();
    
    // 更新报警信息
    updateAlarms();
}

function updateDeviceStatus() {
    // 模拟设备状态更新
    const devices = ['vacuumPump', 'perfusionPump', 'v1', 'v2', 'v3'];
    
    devices.forEach(device => {
        // 随机更新设备状态
        if (Math.random() > 0.95) {
            state[device] = !state[device];
        }
    });
    
    // 更新设备状态显示
    document.getElementById('statVacuum').textContent = state.vacuumPump ? '运行中' : '待机';
    document.getElementById('statPump').textContent = state.perfusionPump ? '运行中' : '待机';
    document.getElementById('statValve').textContent = (state.v1 && state.v2 && state.v3) ? '正常' : '异常';
    
    // 更新设备状态图标
    const vacuumIcon = document.getElementById('statVacuumIcon');
    const pumpIcon = document.getElementById('statPumpIcon');
    const valveIcon = document.getElementById('statValveIcon');
    
    vacuumIcon.className = `device-stat-icon ${state.vacuumPump ? 'running' : 'warning'}`;
    pumpIcon.className = `device-stat-icon ${state.perfusionPump ? 'running' : 'warning'}`;
    valveIcon.className = `device-stat-icon ${(state.v1 && state.v2 && state.v3) ? 'running' : 'error'}`;
    
    // 更新3D场景中的设备状态标签图片
    if (window.deviceStatusLabels) {
        updateDeviceStatusImages();
    }
    
    // 更新设备状态统计（正常、待机、故障、停机）
    updateDeviceStatusStatistics();
}

function updateDeviceStatusStatistics() {
    if (!window.models) return;
    
    const deviceNames = Object.keys(window.models);
    
    let normalCount = 0;  // 正常运行
    let pausedCount = 0;  // 待机
    let faultCount = 0;   // 故障
    let stoppedCount = 0; // 停机
    
    deviceNames.forEach(function(deviceId) {
        // 判断设备类型
        const isGZJ = deviceId.startsWith('GZJ_');
        const isCZK = deviceId.startsWith('CZK_');
        
        // 检查是否为故障设备（包括GZJ和CZK的故障）
        const isFaulty = (isGZJ && state.gzjFaultyDevices[deviceId]) ||
                         (isCZK && state.czkFaultyDevices[deviceId]) ||
                         state.faultyDevices[deviceId];
        
        if (isFaulty) {
            faultCount++;
        } else if (isGZJ) {
            // GZJ设备：根据gzjPhase判断
            if (state.gzjPhase === '运行中') {
                normalCount++;
            } else if (state.gzjPhase === '暂停') {
                pausedCount++;
            } else {
                stoppedCount++;
            }
        } else if (isCZK) {
            // CZK设备：根据czkPhase判断
            if (state.czkPhase === '运行中') {
                normalCount++;
            } else if (state.czkPhase === '暂停') {
                pausedCount++;
            } else {
                stoppedCount++;
            }
        } else {
            // 其他设备：默认停机
            stoppedCount++;
        }
    });
    
    // 更新显示
    document.getElementById('statusNormalCount').textContent = normalCount;
    document.getElementById('statusPausedCount').textContent = pausedCount;
    document.getElementById('statusFaultCount').textContent = faultCount;
    document.getElementById('statusStoppedCount').textContent = stoppedCount;
}

function updateProcessParams() {
    // 系统未运行时，不更新实时数据（保持静止状态）
    if (!state.isRunning) {
        return;
    }

    // 模拟工艺参数更新
    if (state.vacuumPump) {
        state.vacuum = Math.min(state.vacuum + 0.1, 100);
    } else {
        state.vacuum = Math.max(state.vacuum - 0.05, 0);
    }
    
    if (state.perfusionPump) {
        state.flow = Math.min(state.flow + 0.2, 50);
    } else {
        state.flow = Math.max(state.flow - 0.1, 0);
    }
    
    // 模拟温度变化
    state.temperature += (Math.random() - 0.5) * 0.1;
    state.temperature = Math.max(20, Math.min(30, state.temperature));
    
    // 模拟压力变化
    state.pressure = state.vacuum * 0.8;
    
    // 更新显示
    document.getElementById('vacuumVal').textContent = state.vacuum.toFixed(1);
    document.getElementById('flowVal').textContent = state.flow.toFixed(1);
    document.getElementById('tempVal').textContent = state.temperature.toFixed(1);
    document.getElementById('pressureVal').textContent = state.pressure.toFixed(1);
    
    // 更新工艺参数面板
    document.getElementById('vacuumGaugeNum').textContent = state.vacuum.toFixed(1);
    document.getElementById('flowGaugeNum').textContent = state.flow.toFixed(1);
    document.getElementById('tempGaugeNum').textContent = state.temperature.toFixed(1);
    document.getElementById('pressureGaugeNum').textContent = state.pressure.toFixed(1);
    
    // 更新进度条
    document.getElementById('vacuumBarFill').style.width = `${state.vacuum}%`;
    document.getElementById('flowBarFill').style.width = `${state.flow * 2}%`;
    document.getElementById('tempBarFill').style.width = `${(state.temperature - 20) * 10}%`;
    document.getElementById('pressureBarFill').style.width = `${state.pressure}%`;
    
    // 更新系统温度显示
    document.getElementById('statTemp').textContent = `${state.temperature.toFixed(1)}°C`;
    
    // 更新工序进度和工艺统计
    updateProcessProgress();
    updateProcessStatistics();
}

function updateProcessProgress() {
    // 更新抽真空工序进度（平滑填充动画）
    if (state.czkPhase === '运行中') {
        // 每帧增加1.8%，约5.5秒从0%到100%（平滑动画）
        state.vacuumProgress = Math.min(state.vacuumProgress + 1.8, 100);
    } else if (state.czkPhase === '暂停') {
        // 暂停时保持当前进度（不归零）
        state.vacuumProgress = Math.min(state.vacuumProgress, 100);
    } else {
        // 停机或待机时逐渐减少到0%
        state.vacuumProgress = Math.max(state.vacuumProgress - 0.8, 0);
    }
    
    // 更新灌注工序进度（平滑填充动画）
    if (state.gzjPhase === '运行中') {
        // 每帧增加1.5%，约6.7秒从0%到100%（稍慢于抽真空）
        state.perfusionProgress = Math.min(state.perfusionProgress + 1.5, 100);
    } else if (state.gzjPhase === '暂停') {
        // 暂停时保持当前进度（不归零）
        state.perfusionProgress = Math.min(state.perfusionProgress, 100);
    } else {
        // 停机或待机时逐渐减少到0%
        state.perfusionProgress = Math.max(state.perfusionProgress - 0.6, 0);
    }
    
    // 更新显示（带动画效果）
    const vacuumProgressBar = document.getElementById('vacuumProgressBar');
    const vacuumProgressValue = document.getElementById('vacuumProgressValue');
    const perfusionProgressBar = document.getElementById('perfusionProgressBar');
    const perfusionProgressValue = document.getElementById('perfusionProgressValue');
    
    // 更新进度条宽度（CSS transition 会提供平滑过渡）
    if (vacuumProgressBar) {
        vacuumProgressBar.style.width = `${state.vacuumProgress}%`;
    }
    
    // 更新数字百分比（整数显示，平滑递增）
    if (vacuumProgressValue) {
        vacuumProgressValue.textContent = `${Math.round(state.vacuumProgress)}%`;
    }
    
    // 更新进度条宽度
    if (perfusionProgressBar) {
        perfusionProgressBar.style.width = `${state.perfusionProgress}%`;
    }
    
    // 更新数字百分比
    if (perfusionProgressValue) {
        perfusionProgressValue.textContent = `${Math.round(state.perfusionProgress)}%`;
    }
}

function updateProcessStatistics() {
    // 系统未运行时，不更新工艺统计数据（保持静止状态）
    if (!state.isRunning) {
        return;
    }

    // 工序进度都达到100%后，数据稳定不再跳动
    if (state.vacuumProgress >= 99.9 && state.perfusionProgress >= 99.9) {
        return;
    }

    // 获取所有设备
    const deviceNames = Object.keys(window.models || {});
    const totalDevices = deviceNames.length;

    if (totalDevices === 0) return;

    // 统计正常运行设备数量
    let normalCount = 0;
    let faultyCount = 0;

    deviceNames.forEach(function(deviceId) {
        const isGZJ = deviceId.startsWith('GZJ_');
        const isCZK = deviceId.startsWith('CZK_');

        // 检查是否为故障设备
        const isFaulty = (isGZJ && state.gzjFaultyDevices[deviceId]) ||
                         (isCZK && state.czkFaultyDevices[deviceId]) ||
                         state.faultyDevices[deviceId];

        if (isFaulty) {
            faultyCount++;
        } else if ((isGZJ && state.gzjPhase === '运行中') || (isCZK && state.czkPhase === '运行中')) {
            normalCount++;
        }
    });

    // 计算正常运行率（基于正常运行设备数量）
    const normalRate = totalDevices > 0 ? (normalCount / totalDevices) * 100 : 0;

    // 计算工艺稳定性（基于设备正常运行率）
    let stabilityBase = 85 + normalRate * 0.15; // 基础85% + 正常率贡献

    // 根据温度波动调整稳定性
    const tempVariation = Math.abs(state.temperature - 25);
    stabilityBase -= tempVariation * 0.1;

    // 添加微小随机波动（±0.3%）
    stabilityBase += (Math.random() - 0.5) * 0.6;

    // 限制范围
    state.stability = Math.max(80, Math.min(99.9, stabilityBase));

    // 计算成功率（基于稳定性和正常运行率）
    let successRateBase = state.stability * 0.98 + normalRate * 0.02;

    // 如果有故障，额外降低成功率
    if (faultyCount > 0) {
        successRateBase -= faultyCount * 1.2;
    }

    // 添加微小随机波动（±0.2%）
    successRateBase += (Math.random() - 0.5) * 0.4;

    // 限制范围
    state.successRate = Math.max(75, Math.min(99.9, successRateBase));

    // 更新显示
    const stabilityEl = document.getElementById('stabilityValue');
    const successRateEl = document.getElementById('successRateValue');

    if (stabilityEl) {
        stabilityEl.textContent = `${state.stability.toFixed(1)}%`;
        if (state.stability >= 95) {
            stabilityEl.style.color = '#4ade80';
            stabilityEl.style.textShadow = '0 0 10px rgba(74, 222, 128, 0.5)';
        } else if (state.stability >= 90) {
            stabilityEl.style.color = '#fbbf24';
            stabilityEl.style.textShadow = '0 0 10px rgba(251, 191, 36, 0.5)';
        } else {
            stabilityEl.style.color = '#ef4444';
            stabilityEl.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
        }
    }

    if (successRateEl) {
        successRateEl.textContent = `${state.successRate.toFixed(1)}%`;
        if (state.successRate >= 95) {
            successRateEl.style.color = '#4ade80';
            successRateEl.style.textShadow = '0 0 10px rgba(74, 222, 128, 0.5)';
        } else if (state.successRate >= 90) {
            successRateEl.style.color = '#fbbf24';
            successRateEl.style.textShadow = '0 0 10px rgba(251, 191, 36, 0.5)';
        } else {
            successRateEl.style.color = '#ef4444';
            successRateEl.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
        }
    }
}

function updateAlarms() {
    // 模拟报警生成
    if (Math.random() > 0.99) {
        const alarmTypes = ['error', 'warning', 'info'];
        const alarmType = alarmTypes[Math.floor(Math.random() * alarmTypes.length)];
        const alarmMessages = {
            error: '设备故障',
            warning: '参数异常',
            info: '系统状态变更'
        };
        
        const alarm = {
            type: alarmType,
            message: alarmMessages[alarmType],
            time: new Date().toLocaleTimeString()
        };
        
        state.alarms.unshift(alarm);
        state.alarmCount++;
        
        // 限制报警数量
        if (state.alarms.length > 10) {
            state.alarms.pop();
        }
        
        // 更新报警显示
        updateAlarmDisplay();
    }
}

function updateAlarmDisplay() {
    const alarmLog = document.getElementById('alarmLog');
    if (alarmLog) {
        alarmLog.innerHTML = '';
        
        state.alarms.forEach(alarm => {
            const alarmEntry = document.createElement('div');
            alarmEntry.className = `alarm-entry ${alarm.type}`;
            alarmEntry.innerHTML = `
                <div class="alarm-time">${alarm.time}</div>
                <div class="alarm-desc">${alarm.message}</div>
            `;
            alarmLog.appendChild(alarmEntry);
        });
    }
    
    // 更新报警计数
    const alarmCountElement = document.getElementById('alarmCount');
    if (alarmCountElement) {
        alarmCountElement.textContent = state.alarmCount;
    }
}

function updateDeviceCount() {
    const czkCount = Object.keys(window.models).filter(key => key.startsWith('CZK_')).length;
    const gzjCount = Object.keys(window.models).filter(key => key.startsWith('GZJ_')).length;
    const totalCount = czkCount + gzjCount;
    const totalModels = 28; // 总模型数量
    const progress = Math.round((totalCount / totalModels) * 100);
    
    const czkCountElement = document.getElementById('czkCount');
    const gzjCountElement = document.getElementById('gzjCount');
    const equipmentTotalElement = document.getElementById('equipmentTotal');
    
    if (czkCountElement) czkCountElement.textContent = czkCount;
    if (gzjCountElement) gzjCountElement.textContent = gzjCount;
    if (equipmentTotalElement) equipmentTotalElement.textContent = totalCount;
    
    // 在页面上显示加载状态
    const statusElement = document.getElementById('modelLoading');
    if (statusElement) {
        statusElement.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">模型加载中: ${totalCount}/${totalModels}</div>
            <div class="loading-progress">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
        `;
        if (totalCount >= totalModels) {
            setTimeout(() => {
                statusElement.innerHTML = '<div class="loading-text" style="color: #22d3ee;">模型加载完成</div>';
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 1000);
            }, 500);
        }
    }
}

function tickClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('clock').textContent = timeString;
}

function testRandomFault() {
    // 开始抽真空灌注（控制所有设备：GZJ_1-4 + CZK_1-24）
    state.gzjPhase = '运行中';
    state.czkPhase = '运行中';
    state.perfusionPump = true;
    state.vacuumPump = true;
    
    // 播放模型动画
    playModelAnimation();
    
    // 获取所有设备（GZJ + CZK）
    const allDevices = Object.keys(window.models);
    const gzjDevices = allDevices.filter(key => key.startsWith('GZJ_'));
    const czkDevices = allDevices.filter(key => key.startsWith('CZK_'));
    
    // 随机选择1-2个GZJ设备设为故障
    const gzjFaultCount = Math.floor(Math.random() * 2) + 1;
    const gzjShuffled = gzjDevices.sort(() => 0.5 - Math.random());
    const gzjFaulty = gzjShuffled.slice(0, gzjFaultCount);
    
    // 随机选择2-5个CZK设备设为故障
    const czkFaultCount = Math.floor(Math.random() * 4) + 2;
    const czkShuffled = czkDevices.sort(() => 0.5 - Math.random());
    const czkFaulty = czkShuffled.slice(0, czkFaultCount);
    
    // 合并所有故障设备
    const allFaultyDevices = [...gzjFaulty, ...czkFaulty];
    
    // 重置所有设备为正常，然后设置故障设备
    state.gzjFaultyDevices = {};
    state.czkFaultyDevices = {};
    state.faultyDevices = {};

    allFaultyDevices.forEach(function(deviceId) {
        if (deviceId.startsWith('GZJ_')) {
            state.gzjFaultyDevices[deviceId] = true;
        } else if (deviceId.startsWith('CZK_')) {
            state.czkFaultyDevices[deviceId] = true;
        }
        state.faultyDevices[deviceId] = true; // 同时更新全局faultyDevices
    });
    
    // 添加故障报警（确保不重复）
    allFaultyDevices.forEach(function(deviceId) {
        const existingAlarm = state.alarms.find(alarm => 
            alarm.type === 'error' && alarm.message.includes(deviceId)
        );
        
        if (!existingAlarm) {
            const alarm = {
                type: 'error',
                message: `${getDeviceDisplayName(deviceId)} 故障`,
                time: new Date().toLocaleTimeString()
            };
            state.alarms.unshift(alarm);
            state.alarmCount++;
        }
    });
    
    // 限制报警数量
    if (state.alarms.length > 10) {
        state.alarms.pop();
    }
    
    // 更新显示
    updateAlarmDisplay();
    updateDeviceStatus();
    updateProcessParams();
    if (window.updateDeviceDataPanel) {
        window.updateDeviceDataPanel();
    }
}

function startPerfuse() {
    // 开始抽真空灌注（控制所有设备：GZJ_1-4 + CZK_1-24）
    state.gzjPhase = '运行中';
    state.czkPhase = '运行中';
    state.perfusionPump = true;
    state.vacuumPump = true;
    state.isRunning = true;

    console.log('startPerfuse called - gzjPhase:', state.gzjPhase, 'czkPhase:', state.czkPhase);
    console.log('window.deviceStatusLabels exists:', !!window.deviceStatusLabels);
    if (window.deviceStatusLabels) {
        console.log('deviceStatusLabels count:', Object.keys(window.deviceStatusLabels).length);
    }

    // 获取所有设备（GZJ + CZK）
    const allDevices = Object.keys(window.models);

    // 随机选择1-3台设备设为故障
    const faultCount = Math.floor(Math.random() * 3) + 1; // 1-3台
    const shuffled = allDevices.sort(() => 0.5 - Math.random());
    const faultyDevices = shuffled.slice(0, Math.min(faultCount, allDevices.length));

    // 重置所有设备为正常，然后设置故障设备
    state.gzjFaultyDevices = {};
    state.czkFaultyDevices = {};
    state.faultyDevices = {};

    faultyDevices.forEach(function(deviceId) {
        if (deviceId.startsWith('GZJ_')) {
            state.gzjFaultyDevices[deviceId] = true;
        } else if (deviceId.startsWith('CZK_')) {
            state.czkFaultyDevices[deviceId] = true;
        }
        state.faultyDevices[deviceId] = true;
    });

    // 添加故障报警（确保不重复）
    faultyDevices.forEach(function(deviceId) {
        const existingAlarm = state.alarms.find(alarm =>
            alarm.type === 'error' && alarm.message.includes(deviceId)
        );

        if (!existingAlarm) {
            const alarm = {
                type: 'error',
                message: `${getDeviceDisplayName(deviceId)} 故障`,
                time: new Date().toLocaleTimeString()
            };
            state.alarms.unshift(alarm);
            state.alarmCount++;
        }
    });

    // 限制报警数量
    if (state.alarms.length > 10) {
        state.alarms.pop();
    }

    // 播放模型动画
    playModelAnimation();

    // 更新显示
    updateAlarmDisplay();
    updateDeviceStatus();
    updateProcessParams();
    if (window.updateDeviceDataPanel) {
        window.updateDeviceDataPanel();
    }
}

function pausePerfuse() {
    // 暂停抽真空灌注（暂停所有设备：GZJ_1-4 + CZK_1-24）
    state.gzjPhase = '暂停';
    state.czkPhase = '暂停';
    state.perfusionPump = false;
    state.vacuumPump = false;
    state.isRunning = false;
    
    // 暂停模型动画
    pauseModelAnimation();
    
    updateDeviceStatus();
    updateProcessParams();
    if (window.updateDeviceDataPanel) {
        window.updateDeviceDataPanel();
    }
}

function stopPerfuse() {
    state.perfusionPump = false;
    state.vacuumPump = false;
    state.phase = '停止';
    state.faultyDevices = {};
    
    // 复位模型动画
    resetModelAnimation();
    
    updateDeviceStatus();
    updateProcessParams();
    updateDeviceStatusStatistics(); // 更新设备状态统计
    if (window.updateDeviceDataPanel) {
        window.updateDeviceDataPanel();
    }
}

function startVacuum() {
    // 开始抽真空（只控制CZK_1-24）
    state.czkPhase = '运行中';
    state.vacuumPump = true;
    
    // 获取所有CZK设备（抽真空机1-24）
    const czkDevices = Object.keys(window.models).filter(key => key.startsWith('CZK_'));
    
    // 随机选择2-5个CZK设备设为故障
    const faultCount = Math.floor(Math.random() * 4) + 2;
    const shuffled = czkDevices.sort(() => 0.5 - Math.random());
    const faultyDevices = shuffled.slice(0, faultCount);
    
    // 重置CZK设备为正常，然后设置故障设备
    state.czkFaultyDevices = {};
    faultyDevices.forEach(function(deviceId) {
        state.czkFaultyDevices[deviceId] = true;
        state.faultyDevices[deviceId] = true; // 同时更新全局faultyDevices
    });
    
    // 添加故障报警（确保不重复）
    faultyDevices.forEach(function(deviceId) {
        const existingAlarm = state.alarms.find(alarm => 
            alarm.type === 'error' && alarm.message.includes(deviceId)
        );
        
        if (!existingAlarm) {
            const alarm = {
                type: 'error',
                message: `${getDeviceDisplayName(deviceId)} 故障`,
                time: new Date().toLocaleTimeString()
            };
            state.alarms.unshift(alarm);
            state.alarmCount++;
        }
    });
    
    // 限制报警数量
    if (state.alarms.length > 10) {
        state.alarms.pop();
    }
    
    // 更新显示
    updateAlarmDisplay();
    updateDeviceStatus();
    updateProcessParams();
    if (window.updateDeviceDataPanel) {
        window.updateDeviceDataPanel();
    }
}

function pauseVacuum() {
    // 暂停抽真空（只控制CZK_1-24）
    state.czkPhase = '暂停';
    state.vacuumPump = false;
    updateDeviceStatus();
    updateProcessParams();
    if (window.updateDeviceDataPanel) {
        window.updateDeviceDataPanel();
    }
}

function reset() {
    // 重置所有状态（包括GZJ和CZK）
    state.status = 'idle';
    state.vacuumPump = false;
    state.perfusionPump = false;
    state.v1 = false;
    state.v2 = false;
    state.v3 = false;
    state.vacuum = 0;
    state.flow = 0;
    state.temperature = 25;
    state.pressure = 0;
    state.progress = 0;
    state.phase = '待机';
    state.faultyDevices = {};
    
    // 重置GZJ设备状态
    state.gzjPhase = '停机';
    state.gzjFaultyDevices = {};
    
    // 重置CZK设备状态
    state.czkPhase = '停机';
    state.czkFaultyDevices = {};
    
    // 复位模型动画
    resetModelAnimation();
    
    // 重置工序进度和工艺统计
    state.vacuumProgress = 0;
    state.perfusionProgress = 0;
    state.stability = 98.5;
    state.successRate = 96.2;
    state.isRunning = false;
    
    // 立即更新进度条显示为0%
    const vacuumProgressBar = document.getElementById('vacuumProgressBar');
    const vacuumProgressValue = document.getElementById('vacuumProgressValue');
    const perfusionProgressBar = document.getElementById('perfusionProgressBar');
    const perfusionProgressValue = document.getElementById('perfusionProgressValue');
    
    if (vacuumProgressBar) vacuumProgressBar.style.width = '0%';
    if (vacuumProgressValue) vacuumProgressValue.textContent = '0%';
    if (perfusionProgressBar) perfusionProgressBar.style.width = '0%';
    if (perfusionProgressValue) perfusionProgressValue.textContent = '0%';
    
    // 更新显示
    updateDeviceStatus();
    updateProcessParams();
    updateDeviceStatusStatistics(); // 更新设备状态统计
    if (window.updateDeviceDataPanel) {
        window.updateDeviceDataPanel();
    }
}

// 模型动画控制函数
function playModelAnimation() {
    if (!mixer || !animationActions || animationActions.length === 0) {
        return;
    }
    
    animationActions.forEach(function(action) {
        action.paused = false;
    });
}

function pauseModelAnimation() {
    if (!mixer || !animationActions || animationActions.length === 0) {
        return;
    }
    
    animationActions.forEach(function(action) {
        action.paused = true;
    });
}

function resetModelAnimation() {
    if (!mixer || !animationActions || animationActions.length === 0) {
        return;
    }
    
    // 停止所有动画
    animationActions.forEach(function(action) {
        action.stop();
        action.reset();
    });
    
    // 重置 mixer 时间
    mixer.time = 0;
    
    // 重新播放并暂停在第一帧
    animationActions.forEach(function(action) {
        action.play();
        action.paused = true;
    });
}

// 用户信息下拉菜单和退出登录功能
document.addEventListener('DOMContentLoaded', function() {
    initUserDropdown();
    checkLoginStatus();
    loadUserInfo();
});

function initUserDropdown() {
    const userInfo = document.getElementById('userInfo');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!userInfo || !userDropdown) return;

    // 点击用户信息区域切换下拉菜单
    userInfo.addEventListener('click', function(e) {
        e.stopPropagation();
        userInfo.classList.toggle('active');
    });

    // 点击页面其他地方关闭下拉菜单
    document.addEventListener('click', function(e) {
        if (userInfo && !userInfo.contains(e.target)) {
            userInfo.classList.remove('active');
        }
    });

    // 退出登录按钮
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            logout();
        });
    }
}

function checkLoginStatus() {
    // 检查是否已登录（可选：如果需要强制登录验证）
    // 如果未登录，可以跳转到登录页
    /*
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
    }
    */
}

function loadUserInfo() {
    // 从 sessionStorage 加载用户信息并显示
    const username = sessionStorage.getItem('username') || '操作员';
    const usernameElement = document.querySelector('.username');
    
    if (usernameElement) {
        usernameElement.textContent = username;
    }

    // 更新头像字母
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
        userAvatar.textContent = username.charAt(0).toUpperCase();
    }
}

function logout() {
    if (confirm('确定要退出登录吗？')) {
        // 清除登录状态
        sessionStorage.clear();
        
        // 跳转到登录页面
        window.location.href = 'login.html';
    }
}

// 页面加载完成后初始化
window.addEventListener('load', init);