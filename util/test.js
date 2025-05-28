// X方向的厚度控制
if (thicknessX > 1) {
  // 上下各2个
  rect.push({
    c: {
      x: midX + ux * rectDis + uy * thicknessX,
      y: midY + uy * rectDis - ux * thicknessX,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
  rect.push({
    c: {
      x: midX - ux * rectDis + uy * thicknessX,
      y: midY - uy * rectDis - ux * thicknessX,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
  rect.push({
    c: {
      x: midX + ux * rectDis - uy * thicknessX,
      y: midY + uy * rectDis + ux * thicknessX,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
  rect.push({
    c: {
      x: midX - ux * rectDis - uy * thicknessX,
      y: midY - uy * rectDis + ux * thicknessX,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
} else {
  // 只绘制中轴线的2个
  rect.push({
    c: {
      x: midX + ux * rectDis,
      y: midY + uy * rectDis,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
  rect.push({
    c: {
      x: midX - ux * rectDis,
      y: midY - uy * rectDis,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
}
// 记录X方向方块数量，后面用于分割
indexFromXtoY = rect.length;
// Y方向的厚度控制
if (thicknessY > 1) {
  rect.push({
    c: {
      x: midX + ux * thicknessY + uy * rectDis,
      y: midY + uy * thicknessY - ux * rectDis,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
  rect.push({
    c: {
      x: midX - ux * thicknessY + uy * rectDis,
      y: midY - uy * thicknessY - ux * rectDis,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
  rect.push({
    c: {
      x: midX + ux * thicknessY - uy * rectDis,
      y: midY + uy * thicknessY + ux * rectDis,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
  rect.push({
    c: {
      x: midX - ux * thicknessY - uy * rectDis,
      y: midY - uy * thicknessY + ux * rectDis,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
} else {
  rect.push({
    c: {
      x: midX + uy * rectDis,
      y: midY - ux * rectDis,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
  rect.push({
    c: {
      x: midX - uy * rectDis,
      y: midY + ux * rectDis,
      r: rForRect,
    },
    ifFill: false,
    strokeStyle: lineColors[otherPlane.name],
    fillStyle: lineColors[otherPlane.name],
    plane: otherPlane.name,
  });
}
