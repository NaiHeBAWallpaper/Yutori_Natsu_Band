let canvas, textbox, gl, shader, batcher, assetManager, skeletonRenderer;
let mvp = new spine.Matrix4();

let lastFrameTime;
let initialLoadTimer;
let modelFrame;
let renderFrame;
let renderTimer;
let spineData;

let customScale = 1;
let targetFps = 60;
let bgmfile = './assets/audio/U mak3 m3 smil3.flac';
let bgmvolume = 0;
let bgm;
let bufferColor = [0.3, 0.3, 0.3];

let introAnimation, acceptingClick;
let dialogBox = false;
let currentVoiceline = 1;
let mouseSelect = -1;
let trackerID = -1;
let untrackerID = -1;
let EPointX, EPointY;
let TPoint, TEye;
let headpatOrigin;
let headpatCooldown = 0;
const headpatTarget = new spine.Vector2();
const headpatOffset = new spine.Vector2();
let flipped = false;

let transpose = 1;

let currentTracks = []; // 跟踪当前播放的音频
window.selectedLanguage = 'Japanese'; // 全局语言变量（挂载到window对象）

const CHARACTER = 'CH0221';
let modelResolution = '8k';
let loadingResolution;
let modelAtlases;
const HAS_A = { eye: false, point: true };

// All voicelines are manually timed for start point and duration. This may not be the most optimized solution, but works for all intents and purposes.

const AUDIO_DETAIL = [
	{
		time: 8000,
		count: 1,
		startTimes: [700],
		dialog: {
			Japanese: [
				"こ、こっち……こっちだ……せんせ……。"
			],
			English: [
				"This... here... teacher..."
			],
			Chinese: [
				"这，这里…是这里…老师…。"
			]
		}
	},
	{
		time: 20000,
		count: 2,
		startTimes: [500, 13500],
		dialog: {
			Japanese: [
				"うう……ドラムセットの中に……いるんだ……黒くてカサカサ動く……あいつが。",
				"いくら探しても見つからなくてぇ……。"
			],
			English: [
				"Ugh... It's inside the drum set... That black, rustling thing...",
				"No matter how much I search, I can't find it..."
			],
			Chinese: [
				"呜呜…鼓架子里面…有东西…那个东西…黑黑的还在簌簌作响。",
				"怎么找都找不到…。"
			]
		}
	},
	{
		time: 19000,
		count: 2,
		startTimes: [1500, 12300],
		dialog: {
			Japanese: [
				"な、何を言ってるのだ、先生！？キヴォトスでアレを怖がらない女子高生なんていないんだよ！？",
				"銃弾なんかよりよっぽど怖いんだよぉ！？"
			],
			English: [
				"W-what are you saying, teacher!? There's no high school girl in Kivotos who isn't afraid of that!",
				"It's way scarier than getting shot!?"
			],
			Chinese: [
				"你，你在说什么呀，老师！？在基沃托斯不怕那个的女子高中生根本就没有的！",
				"这是比中弹还要更加可怕事情！"
			]
		}
	},
	{
		time: 16000,
		count: 3,
		startTimes: [500, 4600, 9600],
		dialog: {
			Japanese: [
				"うぅ、このままでは……",
				"せっかく手に入れた限定マカダミアクッキーが、",
				"餌食になってしまう……"
			],
			English: [
				"Ugh, if this continues...",
				"The limited edition macadamia cookies I worked so hard to get...",
				"Will become its prey..."
			],
			Chinese: [
				"呜呜呜，这样下去…",
				"好不容易入手的限定曲奇就要",
				"就要进它的嘴了…"
			]
		}
	},
	{
		time: 9000,
		count: 2,
		startTimes: [500, 4600],
		dialog: {
			Japanese: [
				"だからお願い、先生……",
				"助けてぇ……。"
			],
			English: [
				"So please, teacher...",
				"Help me..."
			],
			Chinese: [
				"所以帮帮我，老师…",
				"救我…。"
			]
		}
	}
];


const HITBOX = {
	headpat: { xMin: 160, xMax: 840, yMin: 250, yMax: 1250 },
	voiceline: { xMin: 1190, xMax: 2100, yMin: 100, yMax: 820 }
};

const INTRO_TIMEOUT = 19500;
const HEADPAT_CLAMP = 30;
const HEADPAT_DRAG_SCALE = 0.35;
const HEADPAT_FOLLOW_TIME = 0.055;
const HEADPAT_RETURN_TIME = 0.08;
const EYE_CLAMP_X = 200;
const EYE_CLAMP_Y = EYE_CLAMP_X * (9 / 16);
const EYE_STEP = 10;

let mousePos = { x: 0, y: 0 };
let volume = 0.5;
let mouseOptions = { voicelines: true, headpatting: true, mousetracking: true, drawHitboxes: false };

// Helper clamp function. Math does not appear to have clamp() in this version.
function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

// NOTE: X and Y appears to be inversely related from cursor position to bone adjustment.
//       This behavior's reason is unknown, but it LOOKS right so leave it alone!
function trackMouse() {
    let adjX = (mousePos.x / canvas.width) - 0.5;
    let adjY = (mousePos.y / canvas.height) - 0.5;
    TEye.x = TEye.x - (Math.sign(adjX) * EYE_STEP);
    TEye.y = TEye.y + (Math.sign(adjY) * EYE_STEP);
    TEye.x = clamp(TEye.x, EPointX - (Math.abs(adjX) * EYE_CLAMP_X), EPointX + (Math.abs(adjX) * EYE_CLAMP_X));
    TEye.y = clamp(TEye.y, EPointY - (Math.abs(adjY) * EYE_CLAMP_Y), EPointY + (Math.abs(adjY) * EYE_CLAMP_Y));
}

function untrackMouse() {
	if (Math.abs(TEye.y - EPointY) <= EYE_STEP && Math.abs(TEye.x - EPointX) <= EYE_STEP) {
		if (untrackerID != -1) {
			TEye.y = EPointY;
			TEye.x = EPointX;
			clearInterval(untrackerID);
			untrackerID = -1;
			setTimeout(function () {
				acceptingClick = true;
			}, 500);
		}
	}
	if (TEye.y > EPointY) TEye.y -= EYE_STEP;
	if (TEye.y < EPointY) TEye.y += EYE_STEP;
	if (TEye.x > EPointX) TEye.x -= EYE_STEP;
	if (TEye.x < EPointX) TEye.x += EYE_STEP;
}

function applyHeadpat(delta) {
	const dx = headpatTarget.x - headpatOffset.x;
	const dy = headpatTarget.y - headpatOffset.y;
	if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
		headpatOffset.set(headpatTarget.x, headpatTarget.y);
	} else {
		const blend = 1 - Math.exp(-delta / (headpatOrigin ? HEADPAT_FOLLOW_TIME : HEADPAT_RETURN_TIME));
		headpatOffset.x += dx * blend;
		headpatOffset.y += dy * blend;
	}
	TPoint.x += headpatOffset.x;
	TPoint.y += headpatOffset.y;
}

function releaseHeadpatOnExit() {
	if (headpatOrigin && spineData) releasedMouse();
}

function playVoiceline() {
	spineData.state.setEmptyAnimation(1, 1);
	spineData.state.setEmptyAnimation(2, 1);
	spineData.state.addAnimation(1, `Talk_0${currentVoiceline}_M`, false, 0);
	spineData.state.addAnimation(2, `Talk_0${currentVoiceline}_A`, false, 0);
	spineData.state.addEmptyAnimation(1, 0.5, 0);
	spineData.state.addEmptyAnimation(2, 0.5, 0);

	let trackDetails = AUDIO_DETAIL[currentVoiceline - 1];

	setTimeout(function () {
		acceptingClick = true;
		// 当达到末尾时循环回到第一句
		if (currentVoiceline >= AUDIO_DETAIL.length) {
			currentVoiceline = 1;
		} else {
			currentVoiceline = currentVoiceline + 1;
		}
	}, trackDetails.time);

	for (let i = 0; i < trackDetails.count; i++) {
		let track;
		if (trackDetails.count == 1) track = new Audio(`./assets/audio/${CHARACTER}_memoriallobby_${currentVoiceline}.ogg`);
		else track = new Audio(`./assets/audio/${CHARACTER}_memoriallobby_${currentVoiceline}_${(i + 1)}.ogg`);
		track.volume = volume;
		setTimeout(function () {
			track.play();
			currentTracks.push({ track, index: i }); // 记录当前播放的音频
			if (dialogBox) {
				const selectedLanguage = window.selectedLanguage || 'Japanese'; // 使用全局语言变量
				textbox.innerHTML = trackDetails.dialog[selectedLanguage][i];
				if (dialogBox) textbox.style.opacity = 1; // 确保仅当显示对话框时生效
				track.addEventListener('ended', function () {
					currentTracks = currentTracks.filter(t => t.track !== track); // 移除结束的音频
					textbox.style.opacity = 0;
				});
			}
		}, trackDetails.startTimes[i])
	}
}

// Hitbox Scaling
function t(n, side) {
	let d = { x: { length: 2560, mid: (canvas.width / 2) }, y: { length: 1600, mid: (canvas.height / 2) } }
	n = d[side].mid - n;
	n = (d[side].length / (transpose * 2)) - n;
	n = (n - (d[side].length / (transpose * 2))) / customScale;
	return (n + (d[side].length / (transpose * 2))) * transpose;
}

// -1 = [No Entry], 1 = Headpat, 2 = Voiceline, 3 = Eye Track
function pressedMouse(x, y) {
	tx = t(x, 'x');
	ty = t(y, 'y');
	if (tx > HITBOX.headpat.xMin && tx < HITBOX.headpat.xMax && ty > HITBOX.headpat.yMin && ty < HITBOX.headpat.yMax && mouseOptions.headpatting) {
		spineData.state.setAnimation(1, 'Pat_01_M', false);
		if (HAS_A.point) spineData.state.setAnimation(2, 'Pat_01_A', false);
		headpatOrigin = { x, y };
		mouseSelect = 1;
	}
	else if (tx > HITBOX.voiceline.xMin && tx < HITBOX.voiceline.xMax && ty > HITBOX.voiceline.yMin && ty < HITBOX.voiceline.yMax && mouseOptions.voicelines) {
		mouseSelect = 2;
	}
	else if (mouseOptions.mousetracking) {
		if (trackerID == -1) {
			trackerID = setInterval(trackMouse, 20);
		}
		spineData.state.setEmptyAnimation(1, 0);
		spineData.state.setEmptyAnimation(2, 0);
		let eyetracking = spineData.state.addAnimation(1, 'Look_01_M', false, 0);
		eyetracking.mixDuration = 0.2;
		if (HAS_A.eye) {
			let eyetracking2 = spineData.state.addAnimation(2, 'Look_01_A', false, 0);
			eyetracking2.mixDuration = 0.2;
		}
		mousePos.x = x;
		mousePos.y = y;
		mouseSelect = 3;
	}
	else if (mouseSelect == -1) {
		acceptingClick = true;
	}
}

function drawHitboxes() {
	if (!overlay || !overlay.getContext) return;
	const ctx = overlay.getContext('2d');
	if (!ctx) return;

	ctx.clearRect(0, 0, overlay.width, overlay.height);
	if (!mouseOptions.drawHitboxes) return;

	
	ctx.save();
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'red';
	ctx.globalAlpha = 0.5;

	function worldToScreen(n, side) {
		let d = { x: { length: 2560, mid: (canvas.width / 2) }, y: { length: 1600, mid: (canvas.height / 2) } };
		n = (n / transpose) - (d[side].length / (transpose * 2));
		n = n * customScale + (d[side].length / (transpose * 2));
		n = (d[side].length / (transpose * 2)) - n;
		return d[side].mid - n;
	}

	for (const key in HITBOX) {
		const box = HITBOX[key];
		const x1 = worldToScreen(box.xMin, 'x');
		const y1 = worldToScreen(box.yMin, 'y');
		const x2 = worldToScreen(box.xMax, 'x');
		const y2 = worldToScreen(box.yMax, 'y');
		const width = x2 - x1;
		const height = y1 - y2;
		ctx.strokeRect(x1, y2, width, height);
	}

	ctx.restore();
}

function movedMouse(x, y) {
	switch (mouseSelect) {
		case 1: {
			const scale = HEADPAT_DRAG_SCALE * transpose / customScale;
			const parent = TPoint.parent;
			headpatTarget.set(
				parent.worldX + (x - headpatOrigin.x) * scale,
				parent.worldY + (headpatOrigin.y - y) * scale
			);
			parent.worldToLocal(headpatTarget);
			const distance = headpatTarget.length();
			if (distance > HEADPAT_CLAMP) {
				headpatTarget.x *= HEADPAT_CLAMP / distance;
				headpatTarget.y *= HEADPAT_CLAMP / distance;
			}
			break;
		}
		case 2:
			mouseSelect = -1;
			acceptingClick = true;
			break;
		case 3:
			mousePos.x = x;
			mousePos.y = y;
			break;
		default:
	}
}

function releasedMouse() {
	switch (mouseSelect) {
		case 1: {
			headpatOrigin = null;
			headpatTarget.set(0, 0);
			const state = spineData.state;
			const motion = state.setAnimation(1, 'PatEnd_01_M', false);
			const expression = state.setAnimation(2, 'PatEnd_01_A', false);
			state.addEmptyAnimation(1, 0.5, motion.animationEnd);
			state.addEmptyAnimation(2, 0.5, expression.animationEnd);
			headpatCooldown = setTimeout(() => {
				headpatCooldown = 0;
				acceptingClick = true;
			}, 500);
			break;
		}
		case 2:
			playVoiceline();
			break;
		case 3:
			if (trackerID != -1) {
				clearInterval(trackerID);
				trackerID = -1;
			}
			if (untrackerID == -1) {
				untrackerID = setInterval(untrackMouse, 20);
			}
			let eyetracking = spineData.state.setAnimation(1, 'LookEnd_01_M', false);
			let eyetracking2 = spineData.state.setAnimation(2, 'LookEnd_01_A', false);
			eyetracking.mixDuration = 0;
			eyetracking2.mixDuration = 0;
			spineData.state.addEmptyAnimation(1, 0.5, 0);
			spineData.state.addEmptyAnimation(2, 0.5, 0);
			break;
		default:
	}
	mouseSelect = -1;
}

// adjusts mouse values for flipped canvas
function setMouse(event) {
	let ax = event.clientX;
	let ay = event.clientY;
	if (flipped) {
		ax = canvas.width - ax;
	}

	return { x: ax, y: ay }
}

function init() {
	// Wallpaper Engine settings
	window.wallpaperPropertyListener = {
		applyUserProperties: (props) => {
			if (props.schemecolor) {
				bufferColor = props.schemecolor.value.split(" ");
			}
			if (props.alignmentfliph) flipped = props.alignmentfliph.value;
			if (props.scale) {
				customScale = props.scale.value;
				document.documentElement.style.setProperty('--wallpaper-scale', customScale);
				resize();
			}
			if (props.targetfps) targetFps = props.targetfps.value;

			if (props.introanimation) introAnimation = props.introanimation.value;
			if (props.modelresolution) {
				const selected = props.modelresolution.value;
				if (['2k', '4k', '8k'].includes(selected)) modelResolution = selected;
			}
			requestModelResolution();

			if (props.mousetracking) mouseOptions.mousetracking = props.mousetracking.value;
			if (props.headpatting) mouseOptions.headpatting = props.headpatting.value;
			if (props.voicelines) mouseOptions.voicelines = props.voicelines.value;
			if (props.voicevolume) volume = props.voicevolume.value / 100;
			if (props.showdialog) dialogBox = props.showdialog.value;
			if (props.dialogx) textbox.style.left = props.dialogx.value + '%';
			if (props.dialogy) textbox.style.top = props.dialogy.value + '%';
			if (props.drawHitboxes) mouseOptions.drawHitboxes = props.drawHitboxes.value;

			// 新增：监听语言选择
			if (props.dialoglanguage) {
				window.selectedLanguage = props.dialoglanguage.value; // 更新全局语言变量
				// 更新当前播放的音频文本
				currentTracks.forEach(({ track, index }) => {
					const trackDetails = AUDIO_DETAIL[currentVoiceline - 1];
					if (dialogBox && trackDetails.dialog[window.selectedLanguage]) {
						textbox.innerHTML = trackDetails.dialog[window.selectedLanguage][index];
					}
				})
			}
			
			if (props.bgmfile) {
				bgmfile = 'file:///' + props.bgmfile.value.replace("%3A", "\:");
			}
			if (props.bgmvolume) {
				bgmvolume = props.bgmvolume.value / 100;
				if (bgm) bgm.volume = bgmvolume;
			}
		},
		setPaused: function (isPaused) {
			if (bgm) {
				if (isPaused) {
					setTimeout(() => { bgm.volume = 0; }, 200);
				} else {
					setTimeout(() => { bgm.volume = bgmvolume; }, 200);
				}
			}
		}
	};

	textbox = document.getElementById('textbox');

	canvas = document.getElementById('canvas');
	canvas.addEventListener('mouseleave', releaseHeadpatOnExit);
	window.addEventListener('blur', releaseHeadpatOnExit);
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	overlay = document.getElementById('overlay');
	overlay.width = window.innerWidth;
	overlay.height = window.innerHeight;

	let config = { alpha: false, premultipliedAlpha: false };
	gl = canvas.getContext('webgl', config) || canvas.getContext('experimental-webgl', config);
	if (!gl) {
		alert('WebGL is unavailable.');
		return;
	}

	// Create a simple shader, mesh, model-view-projection matrix, SkeletonRenderer, and AssetManager.
	shader = spine.Shader.newTwoColoredTextured(gl);
	batcher = new spine.PolygonBatcher(gl);
	mvp.ortho2d(0, 0, canvas.width - 1, canvas.height - 1);
	skeletonRenderer = new spine.SkeletonRenderer(gl);
	assetManager = new spine.AssetManager(gl);


	initialLoadTimer = setTimeout(() => {
		if (typeof introAnimation === 'undefined') introAnimation = true;
		requestModelResolution();
	}, 350);
	window.addEventListener('pagehide', event => {
		if (event.persisted) return;
		canvas.style.visibility = 'hidden';
		clearTimeout(initialLoadTimer);
		cancelAnimationFrame(modelFrame);
		cancelAnimationFrame(renderFrame);
		clearTimeout(renderTimer);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
	});
}

// CITATION: http://esotericsoftware.com/spine-api-reference#
// CITATION: http://en.esotericsoftware.com/forum/Spine-Unity-Making-the-arm-follow-the-mouse-7856
function interactionLoad() {
	// Touch_Point and Touch_Eye
	TPoint = spineData.skeleton.findBone('Touch_Point');
	TEye = spineData.skeleton.findBone('Touch_Eye');
	EPointX = TEye.x;
	EPointY = TEye.y;

	downaction = canvas.addEventListener('mousedown', function (event) {
		if (!acceptingClick) {
			return;
		}
		acceptingClick = false;
		let mouseData = setMouse(event);
		pressedMouse(mouseData.x, mouseData.y);
	});
	upaction = canvas.addEventListener('mouseup', function () {
		releasedMouse();
	});
	moveaction = canvas.addEventListener('mousemove', function (event) {
		let mouseData = setMouse(event);
		movedMouse(mouseData.x, mouseData.y);
	});

	if (!introAnimation) {
		acceptingClick = true;
	}
	else {
		setTimeout(function () {
			acceptingClick = true;
		}, INTRO_TIMEOUT);
	}

	return 1;
}

function requestModelResolution() {
	if (!assetManager || modelFrame || typeof introAnimation === 'undefined' || loadingResolution === modelResolution) return;
	loadingResolution = modelResolution;
	const directory = loadingResolution === '8k' ? 'assets/' : 'assets/' + loadingResolution + '/';
	const models = [CHARACTER + '_home'];
	const binaryPaths = models.map(name => new URL(directory + name + '.skel', document.baseURI).href);
	const atlasPaths = models.map(name => new URL(directory + name + '.atlas', document.baseURI).href);

	canvas.style.visibility = 'hidden';
	cancelAnimationFrame(renderFrame);
	clearTimeout(renderTimer);
	assetManager.removeAll();
	if (!spineData) binaryPaths.forEach(file => assetManager.loadBinary(file));
	atlasPaths.forEach(file => assetManager.loadTextureAtlas(file));

	function waitForTextures() {
		if (!assetManager.isLoadingComplete()) {
			modelFrame = requestAnimationFrame(waitForTextures);
			return;
		}
		modelFrame = 0;
		if (loadingResolution !== modelResolution) {
			requestModelResolution();
			return;
		}
		const atlases = atlasPaths.map(file => assetManager.get(file));
		if (atlases.some(atlas => !atlas) || (!spineData && binaryPaths.some(file => !assetManager.get(file)))) {
			console.error('Spine model assets are unavailable for resolution: ' + loadingResolution);
			loadingResolution = undefined;
			return;
		}
		if (!spineData) {
			modelAtlases = atlases;
			load(binaryPaths, atlasPaths);
			return;
		}

		// Both resolutions use the same atlas layout and skeleton. Retain the active animation.
		modelAtlases.forEach((atlas, i) => {
			atlas.pages.forEach((page, j) => {
				page.texture = atlases[i].pages[j].texture;
			});
			for (const region of atlas.regions) region.texture = region.page.texture;
		});
		lastFrameTime = Date.now() / 1000;
		render();
		canvas.style.visibility = 'visible';
	}
	modelFrame = requestAnimationFrame(waitForTextures);
}

function load(binaryPaths, atlasPaths) {
	spineData = loadSpineData(binaryPaths[0], atlasPaths[0], false);

	// User Option to skip Intro Animation
	if (introAnimation) {
		spineData.state.addAnimation(0, 'Start_Idle_01', false);

		if (mouseOptions.voicelines) {
			let track = new Audio(`./assets/audio/${CHARACTER}_memoriallobby_0.ogg`);
			track.volume = volume;
			setTimeout(function () {
				track.play();
			}, 11500);
		}
	}

	spineData.state.addAnimation(0, 'Idle_01', true, 0);

	interactionLoad();
	resize();

	// Plays user-defined BGM (if set)
	bgm = new Audio(bgmfile);
	bgm.volume = bgmvolume;
	bgm.loop = true;
	bgm.play();
	bgm.addEventListener('ended', function () {
		this.currentTime = 0;
		this.play();
	}, false);

	lastFrameTime = Date.now() / 1000;
	// Call render every frame.
	render();
	canvas.style.visibility = 'visible';
}

function loadSpineData(binaryPath, atlasPath, premultipliedAlpha) {
	// Load the texture atlas from the AssetManager.
	let atlas = assetManager.get(atlasPath);

	// Create a AtlasAttachmentLoader that resolves region, mesh, boundingbox and path attachments
	let atlasLoader = new spine.AtlasAttachmentLoader(atlas);

	// Create a SkeletonBinary instance for parsing the .skel file.
	let skeletonBinary = new spine.SkeletonBinary(atlasLoader);

	// Set the scale to apply during parsing, parse the file, and create a new skeleton.
	skeletonBinary.scale = 1;
	let skeletonData = skeletonBinary.readSkeletonData(assetManager.get(binaryPath));
	let skeleton = new spine.Skeleton(skeletonData);
	let bounds = calculateSetupPoseBounds(skeleton);

	// Create an AnimationState, and set the initial animation in looping mode.
	let animationStateData = new spine.AnimationStateData(skeleton.data);
	animationStateData.defaultMix = 0.5;
	let animationState = new spine.AnimationState(animationStateData);

	// Pack everything up and return to caller.
	return { skeleton: skeleton, state: animationState, bounds: bounds, premultipliedAlpha: premultipliedAlpha };
}

function calculateSetupPoseBounds(skeleton) {
	skeleton.setToSetupPose();
	skeleton.updateWorldTransform(spine.Physics.update);
	let offset = new spine.Vector2();
	let size = new spine.Vector2();
	skeleton.getBounds(offset, size, []);
	return { offset: offset, size: size };
}

function render() {
    let now = Date.now() / 1000;
    let delta = now - lastFrameTime;

    lastFrameTime = now;

    gl.clearColor(bufferColor[0], bufferColor[1], bufferColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Apply the animation state based on the delta time.
    let skeleton = spineData.skeleton;
    let state = spineData.state;
    let premultipliedAlpha = spineData.premultipliedAlpha;
    state.update(delta);
    state.apply(skeleton);
    const pointX = TPoint.x;
    const pointY = TPoint.y;
    applyHeadpat(delta);
    skeleton.updateWorldTransform(spine.Physics.update);
    TPoint.x = pointX;
    TPoint.y = pointY;

    // Bind the shader and set the texture and model-view-projection matrix.
    shader.bind();
    // 修改这两行，从 spine.webgl.Shader 改为 spine.Shader
    shader.setUniformi(spine.Shader.SAMPLER, 0);
    shader.setUniform4x4f(spine.Shader.MVP_MATRIX, mvp.values);

    // Start the batch and tell the SkeletonRenderer to render the active skeleton.
    batcher.begin(shader);
    skeletonRenderer.premultipliedAlpha = premultipliedAlpha;
    skeletonRenderer.draw(batcher, skeleton);
    batcher.end();

    shader.unbind();

    // throttle fps
	let elapsed = Date.now() / 1000 - now;
	let targetFrameTime = 1 / targetFps;
	let delay = Math.max(targetFrameTime - elapsed, 0) * 1000;

	drawHitboxes();

	renderTimer = setTimeout(() => {
		renderFrame = requestAnimationFrame(render);
	}, delay);
}

function resize() {
	let w = canvas.clientWidth;
	let h = canvas.clientHeight;
	if (canvas.width != w || canvas.height != h) {
		canvas.width = w;
		canvas.height = h;
	}

	// Set values to position skeleton to center of canvas.
	// Will always attempt to Fit to Fill while maintaining aspect ratio. As a result, a scale of [1] will mean different things across various device resolutions.
	let centerX = 0;
	let centerY = 900;
	let wr = canvas.width / 2560;
	let hr = canvas.height / 1600;
	let width = (2560 / customScale);
	let height = (1600 / customScale);

	if (wr < hr) {
		width = height * (canvas.width / canvas.height);

		transpose = 1600 / canvas.height;
	}
	else if (wr > hr) {
		height = width * (canvas.height / canvas.width);

		transpose = 2560 / canvas.width;
	}
	else {
		transpose = 1600 / canvas.height;
	}

	mvp.ortho2d(centerX - width / 2, centerY - height / 2, width, height);
	gl.viewport(0, 0, canvas.width, canvas.height);
}

init();
