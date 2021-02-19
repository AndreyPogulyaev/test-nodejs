const core = require('json-rpc-service');
const BasicController = core.controllers.Basic;
const SettingsModel = require('../models/Settings');
const defaultData = require('../data/default');
const {
    mergeObject,
    getValueByPath,
    getTreeByPath,
    removeTreeByPath,
} = require('../utils/helpers.js');

class Settings extends BasicController {
    constructor({ settingsHooks, ...args }) {
        super(args);

        this._hooks = settingsHooks;
    }

    async get({ path }) {
        const { section, treePath } = this._splitPath(path);

        const query = { section: section, removed: { $ne: true } };

        const projection = {
            section: true,
            tree: true,
        };
        const options = { lean: true };
        const data = await SettingsModel.findOne(query, projection, options);

        if (!data) {
            throw { code: 404, message: 'Not found' };
        }

        const value = getValueByPath(treePath, data.tree);

        if (value === undefined) {
            throw { code: 404, message: 'Not found' };
        }

        return { data: value };
    }

    async getMobileSection() {
        return await this.get({ path: 'mobile' });
    }

    async getList() {
        const query = { removed: { $ne: true } };
        const projection = {
            section: true,
            tree: true,
        };
        const options = { lean: true };
        const items = await SettingsModel.find(query, projection, options);
        const total = items.length;

        return { items, total };
    }

    async add({ path, value }) {
        const { section, treePath } = this._splitPath(path);

        const query = { section, removed: { $ne: true } };
        const projection = {
            section: true,
            tree: true,
        };
        const options = { lean: true };
        const settings = await SettingsModel.findOne(query, projection, options);

        if (settings) {
            if (!getValueByPath(treePath, settings.tree)) {
                const mergedObject = mergeObject(getTreeByPath(treePath, value), settings.tree);
                const dataModel = await SettingsModel.findOneAndUpdate(
                    query,
                    {
                        $set: { tree: mergedObject },
                    },
                    { new: true }
                );

                const data = dataModel.toObject();

                return { data };
            } else {
                throw { code: 400, message: 'This path exists' };
            }
        } else {
            let dataModel;

            try {
                dataModel = await SettingsModel.create({
                    section,
                    tree: getTreeByPath(treePath, value),
                });
            } catch (error) {
                throw error;
            }

            const data = dataModel.toObject();

            return { data };
        }
    }

    async update({ path, value }) {
        const { section, treePath } = this._splitPath(path);

        const query = { section, removed: { $ne: true } };
        const projection = {
            section: true,
            tree: true,
        };
        const options = { lean: true };
        const settings = await SettingsModel.findOne(query, projection, options);

        if (!settings) {
            throw { code: 404, message: 'Not found' };
        }

        if (getValueByPath(treePath, settings.tree) === undefined) {
            throw { code: 404, message: 'Not found tree' };
        }

        const newTree = mergeObject(settings.tree, getTreeByPath(treePath, value));

        const dataModel = await SettingsModel.findOneAndUpdate(
            query,
            {
                $set: { tree: newTree },
            },
            { new: true }
        );

        const data = dataModel.toObject();

        this._startHook(path);
        return { data };
    }

    async remove({ path }) {
        const { section, treePath } = this._splitPath(path);

        console.log('remove', section, treePath);

        if (defaultData[section] instanceof Object) {
            if (getValueByPath(treePath, defaultData[section]) !== undefined) {
                throw { code: 403, message: 'Access denied' };
            }
        }

        const query = { section };
        const projection = {
            section: true,
            tree: true,
        };

        if (!treePath) {
            console.log('remove treePath ', treePath);
            await SettingsModel.updateOne(query, { $set: { removed: true } });
        } else {
            const options = { lean: true };

            const settings = await SettingsModel.findOne(query, projection, options);

            const newTree = removeTreeByPath(treePath, settings.tree);

            const dataModel = await SettingsModel.findOneAndUpdate(
                query,
                {
                    $set: { tree: newTree },
                },
                { new: true }
            );

            const data = dataModel.toObject();

            return { data };
        }
    }

    async createFirstSettingsIfEmpty() {
        const settingsCount = await SettingsModel.countDocuments();

        if (settingsCount !== 0) {
            return;
        }

        Object.entries(defaultData).forEach(([section, tree]) => {
            SettingsModel.create({
                section,
                tree,
            });
        });
    }

    _splitPath(path) {
        const pathArr = path.replace(/\s/g, '').split('.');
        return { section: pathArr[0], treePath: pathArr.slice(1).join('.') };
    }

    _startHook(path) {
        if (this._hooks[path]) {
            const hook = this._hooks[path];
            hook.handler.call(hook.scope || null);
        } else {
            const pathArr = path.split('.');
            if (pathArr.length > 1) {
                this._startHook(pathArr.slice(0, pathArr.length - 1).join('.'));
            }
        }
    }
}

module.exports = Settings;