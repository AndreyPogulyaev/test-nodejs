function getValueByPath(path, tree) {
    if (path === '') {
        return tree;
    }

    return path.split('.').reduce((o, i) => {
        if (o && o[i] !== undefined) {
            return o[i];
        } else {
            return undefined;
        }
    }, tree);
}

function getTreeByPath(path, value) {
    return path
        .split('.')
        .reverse()
        .reduce((acc, current) => {
            if (!acc) {
                return { [current]: value };
            } else {
                return { [current]: acc };
            }
        }, false);
}

function removeTreeByPath(path, tree) {
    path.split('.').reduce((acc, current) => {
        if (acc[current] instanceof Object) {
            return acc[current];
        } else {
            delete acc[current];
        }
    }, tree);
    return tree;
}

function mergeObject(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object) {
            Object.assign(source[key], mergeObject(target[key], source[key]));
        }
    }

    Object.assign(target || {}, source);
    return target;
}

module.exports = {
    getValueByPath,
    getTreeByPath,
    removeTreeByPath,
    mergeObject,
};
