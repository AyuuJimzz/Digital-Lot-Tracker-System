import { buildAutomaticPlanMask } from "./blueprintAutoCrop";
const rectangle = (x, y, w, h, nonSaleable = false) => ({ nonSaleable,
  points: [[x, y], [x+w, y], [x+w, y+h], [x, y+h]] });
const detection = (candidates) => ({ pageWidth: 600, pageHeight: 400, candidates });
const contains = (plan, x, y) => plan.mask[Math.floor(y * plan.height) * plan.width + Math.floor(x * plan.width)];

test("keeps lots, reserved areas and internal road gaps while removing outside content", () => {
  const plan = buildAutomaticPlanMask(detection([
    rectangle(.3, .2, .12, .2), rectangle(.44, .2, .12, .2), rectangle(.58, .2, .12, .2, true),
    rectangle(.3, .43, .12, .2), rectangle(.44, .43, .12, .2), rectangle(.58, .43, .12, .2),
  ]));
  for (const [x, y] of [[.35,.3],[.43,.3],[.64,.3],[.5,.415]]) expect(contains(plan, x, y)).toBe(1);
  for (const [x, y] of [[.1,.3],[.9,.3],[.5,.9]]) expect(contains(plan, x, y)).toBe(0);
  expect(plan.cropBounds.width).toBeLessThan(50);
});

test("retains separate parcel clusters without filling a large outside notch", () => {
  const plan = buildAutomaticPlanMask(detection([
    rectangle(.25,.2,.1,.1), rectangle(.25,.31,.1,.1), rectangle(.36,.31,.1,.1),
    rectangle(.8,.7,.1,.1,true),
  ]));
  expect(contains(plan,.85,.75)).toBe(1);
  expect(contains(plan,.43,.23)).toBe(0);
  expect(contains(plan,.6,.5)).toBe(0);
});

test("falls back without sufficient reliable geometry", () => {
  expect(buildAutomaticPlanMask(null)).toBeNull();
  expect(buildAutomaticPlanMask(detection([]))).toBeNull();
  expect(buildAutomaticPlanMask(detection([rectangle(.2,.2,.1,.1)]))).toBeNull();
  expect(buildAutomaticPlanMask(detection(Array(3).fill({points:[[NaN,0],[0,0],[1,1]]})))).toBeNull();
});

test("large PDF pages use a bounded mask", () => {
  const plan = buildAutomaticPlanMask({ ...detection([rectangle(.2,.2,.1,.1),rectangle(.4,.2,.1,.1),rectangle(.6,.2,.1,.1)]), pageWidth: 10000, pageHeight: 7000 });
  expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(1400);
});