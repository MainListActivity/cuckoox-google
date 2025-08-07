import type {Reporter, TestModule} from "vitest/node";

/**
 * 简洁的文件状态 Reporter
 * 只在测试过程中实时打印每个文件的通过/失败状态，抑制所有其他输出
 */
export class FileStatusReporter implements Reporter {
    private processedFiles = new Set<string>();

    onInit() {
        // 抑制默认输出
        process.stdout.write("start\n");
    }

    onTestModuleEnd(testModule: TestModule) {
        // 避免重复处理同一文件
        if (this.processedFiles.has(testModule.moduleId)) {
            return;
        }
        this.processedFiles.add(testModule.moduleId);

        const result = testModule.state();
        if (!result) {
            return;
        }

        // 获取相对路径
        const relativePath = testModule.moduleId.replace(process.cwd() + "/", "");

        // 实时打印结果
        process.stdout.write(`${result}  ${relativePath}\n`);
        for (const failedTest of testModule.children.allTests("failed")) {
            process.stdout.write(`    ${failedTest.fullName}  ${failedTest.result().state}  ${failedTest.result().errors?.map(err => err.name).join(",")}\n`);
        }
    }

    onTestRunEnd() {
        // 测试结束时简单换行
        this.processedFiles.clear();
    }

    // 抑制所有其他输出
    onUserConsoleLog() {
        // 不输出任何console日志
    }

    onTestRunStart() {
        // 清理之前的状态
        this.processedFiles.clear();
    }
}

// 导出构造函数
export default FileStatusReporter;
