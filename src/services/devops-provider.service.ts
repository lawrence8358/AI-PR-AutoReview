import { DevOpsService, DevOpsServiceConfig } from '../interfaces/devops-service.interface';
import { AzureDevOpsService } from './azure-devops.service';
import { GitHubDevOpsService } from './github-devops.service';

/**
 * DevOps 服務提供者類別
 * 統一管理所有 DevOps 服務的建立和存取
 */
export class DevOpsProviderService {
    private services: Map<string, DevOpsService>;
    private configs: Map<string, DevOpsServiceConfig>;

    /**
     * 建立 DevOps 服務提供者實例
     */
    constructor() {
        this.services = new Map();
        this.configs = new Map();
    }

    /**
     * 註冊 DevOps 服務設定
     * @param provider - DevOps 服務提供者名稱（azure 或 github）
     * @param config - DevOps 服務設定
     * @throws {Error} 當設定無效時拋出錯誤
     */
    public registerService(provider: string, config: DevOpsServiceConfig): void {
        if (!config.accessToken || config.accessToken.trim() === '') {
            throw new Error('⛔ Access token is required');
        }

        this.configs.set(provider.toLowerCase(), config);
    }

    /**
     * 取得 DevOps 服務實例
     * @param provider - DevOps 服務提供者名稱（azure 或 github）
     * @returns DevOps 服務實例
     * @throws {Error} 當提供者不支援或未註冊時拋出錯誤
     */
    public getService(provider: string): DevOpsService {
        const normalizedProvider = provider.toLowerCase();

        // 檢查是否已有實例
        if (this.services.has(normalizedProvider)) {
            return this.services.get(normalizedProvider)!;
        }

        // 檢查是否有設定
        const config = this.configs.get(normalizedProvider);
        if (!config) {
            throw new Error(`⛔ Service ${provider} is not registered`);
        }

        // 建立新實例
        let service: DevOpsService;
        switch (normalizedProvider) {
            case 'azure':
            case 'azuredevops':
                service = new AzureDevOpsService(config.accessToken, config.organizationUrl);
                break;
            case 'github':
                service = new GitHubDevOpsService(config.accessToken, config.organizationUrl);
                break;
            default:
                throw new Error(`⛔ Unsupported DevOps provider: ${provider}`);
        }

        // 快取實例
        this.services.set(normalizedProvider, service);
        return service;
    }

    /**
     * 自動偵測提供者類型
     * @param organizationUrl - 組織 URL
     * @returns 提供者名稱（azure 或 github）
     */
    public static detectProvider(organizationUrl?: string): 'azure' | 'github' {
        console.log(`🚩 Detecting provider from organizationUrl: ${organizationUrl}`);
        if (!organizationUrl) {
            return 'azure'; // 預設為 Azure
        }

        const url = organizationUrl.toLowerCase();
        if (url.includes('github')) {
            return 'github';
        }

        return 'azure';
    }

    /**
     * 檢查服務是否已註冊
     * @param provider - DevOps 服務提供者名稱
     * @returns 是否已註冊
     */
    public hasService(provider: string): boolean {
        return this.configs.has(provider.toLowerCase());
    }

    /**
     * 移除服務註冊
     * @param provider - DevOps 服務提供者名稱
     */
    public removeService(provider: string): void {
        const normalizedProvider = provider.toLowerCase();
        this.configs.delete(normalizedProvider);
        this.services.delete(normalizedProvider);
    }
}
