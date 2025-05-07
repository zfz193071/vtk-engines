const RENADER = {
    renderImage(rendercanvasID, image, scale, rotate, translate, canvasWidth, canvasHeight) {
        let canvasEle = document.getElementById(rendercanvasID)
        canvasEle.width = canvasWidth
        canvasEle.height = canvasHeight

        let canvasEle_ctx = canvasEle.getContext('2d')
        this.ctxDrawImage(canvasEle_ctx, image, scale, rotate, translate, canvasWidth, canvasHeight)
    },
    ctxDrawImage(canvasEle_ctx, image, scale, rotate, translate, canvasWidth, canvasHeight) {
        let { ifInterPro, interCImg } = image
        //允许图像在调窗之后做一个缩放
        if (ifInterPro) {
            let scale_self = { x: interCImg.width / image.width, y: interCImg.height / image.height }
            scale.x = scale.x / scale_self.x
            scale.y = scale.y / scale_self.y
            image = image.interCImg
        }
        //旋转平移缩放
        canvasEle_ctx.save();
        canvasEle_ctx.scale(scale.x, scale.y);
        // 平移到中心点
        let tempX =
            (canvasWidth / 2 + translate.x) / scale.x - image.width / 2;
        let tempY =
            (canvasHeight / 2 + translate.y) / scale.y - image.height / 2;
        canvasEle_ctx.translate(tempX, tempY);
        // 最后做旋转
        canvasEle_ctx.translate(image.width / 2, image.height / 2);
        canvasEle_ctx.scale(1 / scale.x, 1 / scale.y);
        canvasEle_ctx.rotate(rotate);
        canvasEle_ctx.scale(scale.x, scale.y);
        canvasEle_ctx.translate(-image.width / 2, -image.height / 2);

        canvasEle_ctx.drawImage(image, 0, 0)
        canvasEle_ctx.restore()

    }
}

export default RENADER