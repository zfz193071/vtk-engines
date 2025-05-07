const IMTA = {
    create16BitData(imageWidth, imageHeight, min, max) {
        let dataBuf = new Int16Array(imageWidth * imageHeight)
        //边
        let margin = 5
        //在1/3处画一个方形
        let dX = Math.round(imageWidth / 3)
        let dY = Math.round(imageHeight / 3)
        for (let j = 0; j < imageHeight; j++) {
            for (let i = 0; i < imageWidth; i++) {
                let index = j * imageWidth + i
                if (i < margin || j < margin || i > imageWidth - 1 - margin || j > imageHeight - 1 - margin) {//边
                    dataBuf[index] = max
                } else if (dX <= i && i <= dX * 2 && dY <= j && j <= dY * 2) {
                    dataBuf[index] = i % 4 ? min : max
                }
                else {
                    dataBuf[index] = min
                }
            }
        }
        let resp = {
            width: imageWidth,
            height: imageHeight,
            data: dataBuf
        }
        return resp
    },
    loadImage(url) {
        return new Promise((resolve, reject) => {
            let img = new Image()

            console.log("loadImage")
            img.onload = () => {
                resolve(img)
            };
            img.onerror = (e) => {
                console.log("error", e)
                reject
            };
            img.src = url;
        })
    },
    readData(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = _e => resolve(reader.result.toString());
            reader.onerror = _e => reject(reader.error);
            reader.onabort = _e => reject(new Error("Read aborted"));
            reader.readAsDataURL(blob);
        })
    },

}

export default IMTA