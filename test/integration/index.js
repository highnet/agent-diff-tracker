"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const path = require("path");
const mocha_1 = require("mocha");
const glob_1 = require("glob");
async function run() {
    const mocha = new mocha_1.default({ ui: 'bdd', color: true, timeout: 20000 });
    const testsRoot = path.resolve(__dirname);
    const files = await (0, glob_1.glob)('**/*.suite.js', { cwd: testsRoot });
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
    return new Promise((resolve, reject) => {
        mocha.run((failures) => {
            if (failures > 0)
                reject(new Error(`${failures} integration test(s) failed.`));
            else
                resolve();
        });
    });
}
//# sourceMappingURL=index.js.map