function renderAndCapture(that, source) {
    console.time("rendervolume");
    //renderWindow是vtk的渲染窗口，在你的代码里面，每一个视图有一个，从fullRenderWindow中获取到的
    that.renderWindow.render();
    //这个canvas Size 是渲染窗宽的dom节点的宽高，注意！！！是dom节点的宽高
    let { width, height } = that.canvasSize;
    let dataLenght = width * height;

    //从这里我们开始定义输出的数据结构
    let imageDataArr = new Uint8ClampedArray(dataLenght * 4);
    let origBuf = new ImageData(imageDataArr, width, height);
    origBuf.isColor = true;
    //获取当前的每像素世界坐标系pixelSpacing，你需要找到全局配置的scale
    let { baseSpacing, baseFactor } = that.imageData.scale;
    let pixelSpacingNow = baseSpacing / baseFactor;

    //当前十字线在世界坐标系上的坐标: 这就是你选择的十字中心点的世界坐标，在你当前项目里，三个世界坐标都是一样的
    let crossOnWorld = [
        that.AcrossPoint.x,
        that.AcrossPoint.y,
        that.AcrossPoint.z,
    ];

    //这是你用新参数normal vector算出来的坐标系，应该要和你renderer之前截取平面使用的坐标系一致
    const axes = CROSS.getAxes(that.AcrossPoint, that.imageData.curViewMod);
    let { newX, newY, newZ } = CROSS.formatAxex(axes);
    //十字相对于左下角的屏幕坐标，是一个0到1之间的值
    let displayCoordsOfCross = that.renderer.worldToNormalizedDisplay(
        crossOnWorld[0],
        crossOnWorld[1],
        crossOnWorld[2],
        width / height,
    );

    //这里会直接返回你的中心点，针对输出图像的图像坐标系
    let CrossOnImage = {
        x: displayCoordsOfCross[0] * width,
        y: (1 - displayCoordsOfCross[1]) * height,
    };
    //转换为世界坐标
    let dic = ["x", "y", "z"];
    let leftTopPos = {};
    for (let i = 0; i < 3; i++) {
        leftTopPos[dic[i]] =
            crossOnWorld[i] -
            CrossOnImage.x * pixelSpacingNow * newX[i] -
            CrossOnImage.y * pixelSpacingNow * newY[i];
    }
    let dataWithInfo = {
        //定义数据结构
        pixelSpacingW: pixelSpacingNow,
        pixelSpacingH: pixelSpacingNow,
        pixelSpacingD: 1, //这个值用不上
        leftTopPos: leftTopPos, //当前图像左上角在世界坐标系上的坐标
        origBuf: origBuf, //原始数据
        isFromVTKClip: true,
        imgorient: [newX, newY, newZ],
        width,
        height,
    };
    console.log(
        "renderAndCapture",
        JSON.stringify(dataWithInfo.leftTopPos, pixelSpacingNow, [
            newX,
            newY,
            newZ,
        ]),
    );
    that.imageData.dataWithInfo = dataWithInfo;
    that.$emit("changeDWIFromVR");
    Vue.prototype.$loading(false);
    console.timeEnd("rendervolume");
}