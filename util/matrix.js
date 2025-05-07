/*
 * @Author: 
 * @Date: 2023-11-23 13:29:10
 * @LastEditTime: 2023-11-23 13:30:52
 * @LastEditors: ssy
 * @Description:    
 */
const MATRIX = {
    //获得不同视图模式下的矩阵
    getMatrix: (viewMod) => {
        let matrix = null
        switch (viewMod) {
            case 0:
                matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1]
                break;
            case 1:
                matrix = [1, 0, 0, 0, 0, -1, 0, 1, 0]
                break;
            case 2:
                matrix = [0, 0, 1, 0, 1, 0, -1, 0, 0]
                break;
            default:
                break;
        }
        return matrix
    },
}

export default MATRIX