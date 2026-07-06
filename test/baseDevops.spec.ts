import { expect } from 'chai';
import { BaseDevOpsService, DEFAULT_BINARY_EXTENSIONS } from '../src/services/base-devops.service';
import { FileChangeDetail } from '../src/interfaces/devops-service.interface';

class TestDevOpsService extends BaseDevOpsService {
    protected getProviderName(): string {
        return 'Test';
    }

    public addPullRequestComment(): Promise<number> {
        return Promise.resolve(1);
    }

    public addInlinePullRequestComment(): Promise<number> {
        return Promise.resolve(1);
    }

    public getPullRequestChanges(): Promise<FileChangeDetail[] | null> {
        return Promise.resolve([]);
    }

    public includeFile(filePath: string, fileExtensions: string[], binaryExtensions: string[]): boolean {
        return this.shouldIncludeFile(filePath, fileExtensions, binaryExtensions);
    }
}

describe('BaseDevOpsService file filtering', () => {
    const service = new TestDevOpsService('token', 'https://dev.azure.com/org');

    it('should exclude EF Core designer files even when .cs files are included', () => {
        const result = service.includeFile('/Models/AppDbContextModelSnapshot.Designer.cs', ['.cs'], DEFAULT_BINARY_EXTENSIONS);

        expect(result).to.equal(false);
    });

    it('should include regular C# files when .cs files are included', () => {
        const result = service.includeFile('/Services/OrderService.cs', ['.cs'], []);

        expect(result).to.equal(true);
    });
});
