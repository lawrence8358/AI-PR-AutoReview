
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import { Main } from '../src/index';

describe('System Prompt Configuration', () => {
    let sandbox: sinon.SinonSandbox;
    let main: Main;
    const testFilePath = path.join(__dirname, 'test-prompt.txt');

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        main = new Main(true); // Enable debug mode to simulate env vars
    });

    afterEach(() => {
        sandbox.restore();
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
        delete process.env.SystemInstructionSource;
        delete process.env.SystemPromptFile;
        delete process.env.SystemInstruction;
    });

    it('should use inline system instruction when source is Inline', () => {
        process.env.SystemInstructionSource = 'Inline';
        process.env.SystemInstruction = 'Inline instruction';

        const inputs = main.getPipelineInputs();
        expect(inputs.systemInstruction).to.equal('Inline instruction');
    });

    it('should use file content when source is File and file exists', () => {
        const fileContent = 'Content from file';
        fs.writeFileSync(testFilePath, fileContent);

        process.env.SystemInstructionSource = 'File';
        process.env.SystemPromptFile = testFilePath;
        process.env.SystemInstruction = 'Default instruction';

        const inputs = main.getPipelineInputs();
        expect(inputs.systemInstruction).to.equal(fileContent);
    });

    it('should fallback to inline when source is File but file does not exist', () => {
        process.env.SystemInstructionSource = 'File';
        process.env.SystemPromptFile = 'non-existent-file.txt';
        process.env.SystemInstruction = 'Inline fallback instruction';

        // Mock console.warn to suppress output during test
        sandbox.stub(console, 'warn');

        const inputs = main.getPipelineInputs();
        expect(inputs.systemInstruction).to.equal('Inline fallback instruction');
    });

    it('should use default instruction when file content is empty', () => {
        const emptyFilePath = path.join(__dirname, 'empty-prompt.txt');
        fs.writeFileSync(emptyFilePath, '   '); // File with only whitespace

        process.env.SystemInstructionSource = 'File';
        process.env.SystemPromptFile = emptyFilePath;
        process.env.SystemInstruction = 'Default from env';

        const warnSpy = sandbox.spy(console, 'warn');
        const inputs = main.getPipelineInputs();

        expect(inputs.systemInstruction).to.include('You are a senior software engineer');
        expect(warnSpy.called).to.be.true;

        if (fs.existsSync(emptyFilePath)) {
            fs.unlinkSync(emptyFilePath);
        }
    });

    it('should default to inline if source is not specified', () => {
        process.env.SystemInstruction = 'Default instruction';

        const inputs = main.getPipelineInputs();
        expect(inputs.systemInstruction).to.equal('Default instruction');
    });
    it('should warn when file extension is not supported', () => {
        const invalidFilePath = path.join(__dirname, 'test.bin');
        process.env.SystemInstructionSource = 'File';
        process.env.SystemPromptFile = invalidFilePath;
        process.env.SystemInstruction = 'Default instruction';

        // Mock console.warn
        const warnSpy = sandbox.spy(console, 'warn');

        main.getPipelineInputs();

        // Check if warning was called with expected message
        expect(warnSpy.called).to.be.true;
        const callArgs = warnSpy.getCall(0).args[0];
        expect(callArgs).to.include("Warning: System prompt file extension '.bin' is not strictly supported");
    });

    it('should use default when file not found and inline is empty', () => {
        process.env.SystemInstructionSource = 'File';
        process.env.SystemPromptFile = 'non-existent-file.txt';
        process.env.SystemInstruction = '';  // Empty inline

        sandbox.stub(console, 'warn');

        const inputs = main.getPipelineInputs();
        expect(inputs.systemInstruction).to.include('You are a senior software engineer');
    });

    it('should use default when inline is empty', () => {
        process.env.SystemInstructionSource = 'Inline';
        process.env.SystemInstruction = '';  // Empty inline

        sandbox.stub(console, 'warn');

        const inputs = main.getPipelineInputs();
        expect(inputs.systemInstruction).to.include('You are a senior software engineer');
    });
});
