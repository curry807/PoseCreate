
import { app } from './main.js';

const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const propInput = $('propInput');
const headsRange = $('headsRange');
const headsLabel = $('headsLabel');
const realismRange = $('realismRange');
const fovRange = $('fovRange');
const bgColor = $('bgColor');

fileInput?.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (!f) return;
  app.loadModelFile(f);
});
propInput?.addEventListener('change', () => {
  const f = propInput.files[0];
  if (!f) return;
  app.loadPropFile(f);
});

$('btnResetPose')?.addEventListener('click', () => app.resetPose());
$('btnMirrorPose')?.addEventListener('click', () => app.mirrorPose());
$('btnFocus')?.addEventListener('click', () => app.focusModel());
$('btnTopDown')?.addEventListener('click', () => app.topDownView());
$('btnAddFloor')?.addEventListener('click', () => app.addFloor());
$('btnAddCube')?.addEventListener('click', () => app.addCubeProp());
$('btnScreenshot')?.addEventListener('click', () => app.screenshot());
$('btnPoseJson')?.addEventListener('click', () => app.exportPoseJson());

headsRange?.addEventListener('input', () => {
  headsLabel.textContent = headsRange.value;
  app.setHeadsRatio(parseFloat(headsRange.value));
});
realismRange?.addEventListener('input', () => app.setRealism(parseFloat(realismRange.value)));
fovRange?.addEventListener('input', () => app.setFov(parseFloat(fovRange.value)));
bgColor?.addEventListener('input', () => app.setBackground(bgColor.value));
