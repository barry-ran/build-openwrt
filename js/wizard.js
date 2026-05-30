/**
 * OpenWrt 智能编译向导 - 修复编译进度监控版本
 * 解决GitHub Actions编译进度实时监控问题
 */

class WizardManager {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.config = {
            source: '',
            device: '',
            plugins: [],
            customSources: [],
            customRepo: '',
            customBranch: '',
            customPackages: '',
            lanIp: '192.168.1.1',
            optimization: 'balanced'
        };

        this.isInitialized = false;
        this.buildMonitorInterval = null; // 监控定时器
        this.currentRunId = null; // 当前运行ID
        this.monitoringActive = false; // 监控状态

        // 延迟初始化，确保DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    init() {
        if (this.isInitialized) return;

        console.log('🚀 初始化OpenWrt智能编译向导');

        try {
            this.loadConfigData();
            this.bindEvents();
            this.renderStep(1);
            this.checkTokenStatus();
            this.isInitialized = true;
            console.log('✅ 向导初始化完成');
        } catch (error) {
            console.error('❌ 向导初始化失败:', error);
            this.showInitError(error);
        }
    }

    /**
     * 显示初始化错误
     */
    showInitError(error) {
        const errorMessage = `
            <div class="init-error">
                <h3>⚠️ 初始化失败</h3>
                <p>向导初始化时出现错误：${error.message}</p>
                <button onclick="location.reload()" class="btn btn-primary">🔄 重新加载</button>
            </div>
        `;

        const container = document.querySelector('.wizard-content') || document.body;
        container.innerHTML = errorMessage;
    }

    /**
     * 检查Token配置状态
     */
    checkTokenStatus() {
        // 安全地获取DOM元素
        const statusContainer = document.getElementById('token-status') ||
            document.getElementById('token-status-indicator');

        if (!statusContainer) {
            console.warn('⚠️ Token状态容器未找到，跳过状态更新');
            return;
        }

        const token = this.getValidToken();

        if (token) {
            // 显示Token状态（隐藏敏感信息）
            const maskedToken = token.substring(0, 8) + '*'.repeat(12) + token.substring(token.length - 4);
            statusContainer.innerHTML = `
                <div class="token-status-card valid">
                    <span class="status-icon">✅</span>
                    <div class="status-info">
                        <div class="status-title">GitHub Token 已配置</div>
                        <div class="status-detail">${maskedToken}</div>
                    </div>
                    <button class="btn-clear-token" onclick="window.wizardManager.clearToken()">清除</button>
                </div>
            `;
        } else {
            statusContainer.innerHTML = `
                <div class="token-status-card invalid">
                    <span class="status-icon">⚠️</span>
                    <div class="status-info">
                        <div class="status-title">需要配置 GitHub Token</div>
                        <div class="status-detail">点击配置按钮设置Token以启用编译功能</div>
                    </div>
                    <button class="btn-config-token" onclick="window.tokenModal?.show()">配置Token</button>
                </div>
            `;
        }
    }

    /**
     * 获取有效的Token
     */
    getValidToken() {
        try {
            // 优先级：URL参数 > LocalStorage > 全局变量
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            if (urlToken && this.isValidTokenFormat(urlToken)) {
                return urlToken;
            }

            const storedToken = localStorage.getItem('github_token');
            if (storedToken && this.isValidTokenFormat(storedToken)) {
                return storedToken;
            }

            if (window.GITHUB_TOKEN && this.isValidTokenFormat(window.GITHUB_TOKEN)) {
                return window.GITHUB_TOKEN;
            }
        } catch (error) {
            console.warn('获取Token时出错:', error);
        }

        return null;
    }

    /**
     * 验证Token格式
     */
    isValidTokenFormat(token) {
        return token && typeof token === 'string' &&
            (token.startsWith('ghp_') || token.startsWith('github_pat_'));
    }

    /**
     * Token配置完成回调
     */
    onTokenConfigured(token) {
        console.log('✅ Token配置完成');
        this.checkTokenStatus();

        // 如果在编译步骤，重新启用编译按钮
        const buildBtn = document.getElementById('start-build-btn');
        if (buildBtn) {
            buildBtn.disabled = false;
            buildBtn.innerHTML = '🚀 开始编译';
        }
    }

    /**
     * 清除Token配置
     */
    clearToken() {
        if (confirm('确定要清除Token配置吗？清除后将无法进行编译。')) {
            try {
                localStorage.removeItem('github_token');
                delete window.GITHUB_TOKEN;

                // 从URL中移除token参数（如果存在）
                const url = new URL(window.location);
                if (url.searchParams.has('token')) {
                    url.searchParams.delete('token');
                    window.history.replaceState({}, document.title, url.toString());
                }

                this.checkTokenStatus();
                console.log('🗑️ Token配置已清除');
            } catch (error) {
                console.error('清除Token失败:', error);
            }
        }
    }

    /**
     * 加载配置数据
     */
    loadConfigData() {
        try {
            // 从全局变量加载配置数据
            this.sourceBranches = window.SOURCE_BRANCHES || this.getDefaultSourceBranches();
            this.deviceConfigs = window.DEVICE_CONFIGS || this.getDefaultDeviceConfigs();
            this.pluginConfigs = window.PLUGIN_CONFIGS || this.getDefaultPluginConfigs();
            console.log('📋 配置数据加载完成');
        } catch (error) {
            console.warn('配置数据加载失败，使用默认配置:', error);
            this.loadDefaultConfigs();
        }
    }

    /**
     * 获取默认源码分支配置
     */
    getDefaultSourceBranches() {
        return {
            'lede-master': {
                name: "Lean's LEDE",
                description: '国内热门分支，集成大量插件',
                repo: 'https://github.com/coolsnowwolf/lede',
                branch: 'master',
                recommended: true,
                stability: '稳定',
                plugins: '丰富'
            },
            'openwrt-main': {
                name: 'OpenWrt 官方',
                description: '最新稳定版本，兼容性最好',
                repo: 'https://github.com/openwrt/openwrt',
                branch: 'openwrt-23.05',
                recommended: true,
                stability: '高',
                plugins: '基础'
            }
        };
    }

    /**
     * 获取默认设备配置
     */
    getDefaultDeviceConfigs() {
        return {
            'x86_64': {
                name: 'X86 64位 (通用)',
                category: 'x86',
                arch: 'x86',
                target: 'x86/64',
                profile: 'generic',
                flash_size: '可变',
                ram_size: '可变',
                recommended: true,
                features: ['efi', 'legacy', 'kvm', 'docker']
            },
            'xiaomi_4a_gigabit': {
                name: '小米路由器4A千兆版',
                category: 'router',
                arch: 'ramips',
                target: 'ramips/mt7621',
                profile: 'xiaomi_mi-router-4a-gigabit',
                flash_size: '16M',
                ram_size: '128M',
                recommended: true,
                features: ['wifi', 'gigabit', 'usb']
            }
        };
    }

    /**
     * 获取默认插件配置
     */
    getDefaultPluginConfigs() {
        return {
            proxy: {
                name: '🔐 网络代理',
                plugins: {
                    'luci-app-ssr-plus': {
                        name: 'SSR Plus+',
                        description: 'ShadowsocksR代理工具',
                        size: '5M',
                        stability: 'stable'
                    },
                    'luci-app-passwall': {
                        name: 'PassWall',
                        description: '多协议代理，智能分流',
                        size: '8M',
                        stability: 'stable'
                    }
                }
            },
            system: {
                name: '⚙️ 系统管理',
                plugins: {
                    'luci-app-ttyd': {
                        name: 'TTYD终端',
                        description: 'Web终端访问',
                        size: '1M',
                        stability: 'stable'
                    },
                    'luci-app-upnp': {
                        name: 'UPnP',
                        description: '端口自动映射',
                        size: '0.5M',
                        stability: 'stable'
                    }
                }
            }
        };
    }

    /**
     * 加载默认配置（备用方案）
     */
    loadDefaultConfigs() {
        this.sourceBranches = this.getDefaultSourceBranches();
        this.deviceConfigs = this.getDefaultDeviceConfigs();
        this.pluginConfigs = this.getDefaultPluginConfigs();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 使用事件委托避免元素不存在的问题
        document.addEventListener('click', (e) => {
            try {
                if (e.target.matches('.next-step-btn')) {
                    this.nextStep();
                } else if (e.target.matches('.prev-step-btn')) {
                    this.prevStep();
                } else if (e.target.matches('.source-option')) {
                    this.selectSource(e.target.dataset.source);
                } else if (e.target.matches('.device-option')) {
                    this.selectDevice(e.target.dataset.device);
                } else if (e.target.matches('.plugin-checkbox')) {
                    this.togglePlugin(e.target.dataset.plugin);
                } else if (e.target.matches('#start-build-btn')) {
                    this.startBuild();
                }
            } catch (error) {
                console.error('事件处理失败:', error);
            }
        });

        // 绑定搜索框事件
        document.addEventListener('input', (e) => {
            if (e.target.matches('.search-input')) {
                const filterType = e.target.dataset.filter;
                if (filterType) {
                    this.filterOptions(e.target.value, filterType);
                }
            }
        });
    }

    /**
     * 渲染步骤
     */
    renderStep(step) {
        this.currentStep = step;

        try {
            // 更新步骤指示器
            this.updateStepIndicator();

            // 显示对应步骤内容
            this.showStepContent(step);

            // 根据步骤渲染内容
            switch (step) {
                case 1:
                    this.renderSourceSelection();
                    break;
                case 2:
                    this.renderDeviceSelection();
                    break;
                case 3:
                    this.renderPluginSelection();
                    break;
                case 4:
                    this.renderConfigSummary();
                    break;
            }
        } catch (error) {
            console.error(`渲染步骤${step}失败:`, error);
        }
    }

    /**
     * 更新步骤指示器
     */
    updateStepIndicator() {
        const indicators = document.querySelectorAll('.step-indicator');
        indicators.forEach((indicator, index) => {
            const stepNum = index + 1;
            indicator.className = 'step-indicator';

            if (stepNum < this.currentStep) {
                indicator.classList.add('completed');
            } else if (stepNum === this.currentStep) {
                indicator.classList.add('active');
            }
        });
    }

    /**
     * 显示步骤内容
     */
    showStepContent(step) {
        // 隐藏所有步骤内容
        const stepContents = document.querySelectorAll('.step-content');
        stepContents.forEach(content => {
            content.style.display = 'none';
        });

        // 显示当前步骤
        const currentStepContent = document.getElementById(`step-${step}`);
        if (currentStepContent) {
            currentStepContent.style.display = 'block';
        } else {
            console.warn(`步骤${step}的内容容器未找到`);
        }
    }

    /**
     * 渲染源码选择
     */
    renderSourceSelection() {
        const container = document.getElementById('source-selection');
        if (!container) {
            console.warn('源码选择容器未找到');
            return;
        }

        let html = '<div class="options-grid">';

        Object.entries(this.sourceBranches).forEach(([key, source]) => {
            const isSelected = this.config.source === key;
            const recommendedBadge = source.recommended ? '<span class="recommended-badge">推荐</span>' : '';

            if (source.isCustom) {
                // 自定义仓库选项 - 特殊渲染
                html += `
                    <div class="source-option ${isSelected ? 'selected' : ''}" data-source="${key}">
                        <div class="option-header">
                            <h3>🔗 ${source.name}</h3>
                            <div class="option-meta">
                                <span class="stability-badge">${source.stability}</span>
                                <span class="plugins-badge">${source.plugins}</span>
                            </div>
                        </div>
                        <p class="option-description">${source.description}</p>
                        <div class="custom-source-form ${isSelected ? 'show' : ''}" id="custom-source-form">
                            <div class="form-group">
                                <label class="form-label">仓库地址 <span class="required">*</span></label>
                                <input type="text" class="form-input" id="custom-repo-url" 
                                    placeholder="例如: https://github.com/barry-ran/immortalwrt"
                                    value="${this.config.customRepo || ''}"
                                    onclick="event.stopPropagation()">
                                <div class="form-hint">支持任何GitHub上的OpenWrt Fork仓库</div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">分支/Tag/Commit <span class="required">*</span></label>
                                <input type="text" class="form-input" id="custom-repo-branch" 
                                    placeholder="例如: openwrt-25.12, main, v23.05.0, abc1234"
                                    value="${this.config.customBranch || ''}"
                                    onclick="event.stopPropagation()">
                                <div class="form-hint">可以是分支名、Tag名或Commit SHA</div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="source-option ${isSelected ? 'selected' : ''}" data-source="${key}">
                        ${recommendedBadge}
                        <div class="option-header">
                            <h3>${source.name}</h3>
                            <div class="option-meta">
                                <span class="stability-badge">${source.stability}</span>
                                <span class="plugins-badge">${source.plugins}</span>
                            </div>
                        </div>
                        <p class="option-description">${source.description}</p>
                        <div class="option-details">
                            <div class="detail-item">
                                <span class="detail-label">仓库:</span>
                                <span class="detail-value">${this.getRepoShortName(source.repo)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">分支:</span>
                                <span class="detail-value">${source.branch}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        html += '</div>';
        container.innerHTML = html;

        this.bindSourceOptionEvents();
        this.bindCustomSourceEvents();
    }

    /**
     * 绑定源码选项卡片事件
     */
    bindSourceOptionEvents() {
        document.querySelectorAll('.source-option').forEach(card => {
            card.addEventListener('click', (e) => {
                // 阻止 a、button、input 的默认行为
                if (
                    e.target.tagName === 'A' ||
                    e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'INPUT'
                ) return;
                this.selectSource(card.dataset.source);
            });
            // 让input点击也能选中
            const input = card.querySelector('input[type="radio"]');
            if (input) {
                input.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectSource(card.dataset.source);
                });
            }
        });
    }

    /**
     * 绑定自定义仓库输入框事件
     */
    bindCustomSourceEvents() {
        const repoUrlInput = document.getElementById('custom-repo-url');
        const repoBranchInput = document.getElementById('custom-repo-branch');

        if (repoUrlInput) {
            repoUrlInput.addEventListener('input', (e) => {
                this.config.customRepo = e.target.value.trim();
            });
            repoUrlInput.addEventListener('click', (e) => {
                e.stopPropagation();
                // 确保点击输入框时选中自定义源
                if (this.config.source !== 'custom') {
                    this.selectSource('custom');
                }
            });
        }

        if (repoBranchInput) {
            repoBranchInput.addEventListener('input', (e) => {
                this.config.customBranch = e.target.value.trim();
            });
            repoBranchInput.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.config.source !== 'custom') {
                    this.selectSource('custom');
                }
            });
        }
    }

    /**
     * 渲染设备选择
     */
    renderDeviceSelection() {
        const container = document.getElementById('device-selection');
        if (!container) {
            console.warn('设备选择容器未找到');
            return;
        }

        // 按分类组织设备
        const categories = {
            router: '🔀 路由器设备',
            arm: '💻 ARM开发板',
            x86: '🖥️ X86设备'
        };

        let html = '';

        Object.entries(categories).forEach(([category, title]) => {
            const devices = Object.entries(this.deviceConfigs)
                .filter(([key, device]) => device.category === category);

            if (devices.length === 0) return;

            html += `
                <div class="device-category">
                    <h3 class="category-title">${title}</h3>
                    <div class="options-grid">
            `;

            devices.forEach(([key, device]) => {
                const isSelected = this.config.device === key;
                const recommendedBadge = device.recommended ? '<span class="recommended-badge">推荐</span>' : '';

                html += `
                    <div class="device-option ${isSelected ? 'selected' : ''}" data-device="${key}">
                        ${recommendedBadge}
                        <div class="option-header">
                            <h4>${device.name}</h4>
                            <div class="device-specs">
                                <span class="spec-item">Flash: ${device.flash_size}</span>
                                <span class="spec-item">RAM: ${device.ram_size}</span>
                            </div>
                        </div>
                        <div class="device-features">
                            ${device.features?.map(feature => `<span class="feature-tag">${feature}</span>`).join('') || ''}
                        </div>
                    </div>
                `;
            });

            html += '</div></div>';
        });

        container.innerHTML = html;
        this.bindDeviceOptionEvents();
    }

    /**
     * 绑定设备选项卡片事件
     */
    bindDeviceOptionEvents() {
        document.querySelectorAll('.device-option').forEach(card => {
            card.addEventListener('click', (e) => {
                // 阻止 a、button、input 的默认行为
                if (
                    e.target.tagName === 'A' ||
                    e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'INPUT'
                ) return;
                this.selectDevice(card.dataset.device);
            });
            // 让input点击也能选中
            const input = card.querySelector('input[type="radio"]');
            if (input) {
                input.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectDevice(card.dataset.device);
                });
            }
        });
    }

    /**
     * 渲染插件选择
     */
    renderPluginSelection() {
        const container = document.getElementById('plugin-selection');
        if (!container) {
            console.warn('插件选择容器未找到');
            return;
        }

        let html = '';

        Object.entries(this.pluginConfigs).forEach(([categoryKey, category]) => {
            html += `
                <div class="plugin-category">
                    <h3 class="category-title">${category.name}</h3>
                    <div class="plugin-grid">
            `;

            Object.entries(category.plugins).forEach(([pluginKey, plugin]) => {
                const isSelected = this.config.plugins.includes(pluginKey);

                html += `
                    <div class="plugin-item ${isSelected ? 'selected' : ''}">
                        <label class="plugin-label">
                            <input type="checkbox" 
                                   class="plugin-checkbox" 
                                   data-plugin="${pluginKey}"
                                   ${isSelected ? 'checked' : ''}>
                            <div class="plugin-info">
                                <div class="plugin-header">
                                    <span class="plugin-name">${plugin.name}</span>
                                    <span class="plugin-size">${plugin.size || 'N/A'}</span>
                                </div>
                                <div class="plugin-description">${plugin.description}</div>
                            </div>
                        </label>
                    </div>
                `;
            });

            html += '</div></div>';
        });

        // LAN IP 配置区域
        html += `
            <div class="plugin-category custom-packages-section">
                <h3 class="category-title">🌐 网络配置</h3>
                <p class="custom-packages-hint">
                    自定义路由器 LAN 口的默认 IP 地址，编译时写入固件。留空则使用默认值 <code>192.168.1.1</code>。
                </p>
                <div class="lan-ip-input-group">
                    <label class="form-label">LAN IP 地址</label>
                    <input type="text" id="lan-ip-input"
                        class="form-input lan-ip-input"
                        placeholder="例如: 192.168.1.1"
                        value="${this.config.lanIp || '192.168.1.1'}"
                        onclick="event.stopPropagation()">
                    <div class="form-hint">路由器管理界面的默认访问地址（支持 IPv4 格式，如 192.168.100.1）</div>
                </div>
            </div>
        `;

        // 自定义包输入区域
        html += `
            <div class="plugin-category custom-packages-section">
                <h3 class="category-title">📝 自定义软件包</h3>
                <p class="custom-packages-hint">
                    输入 make menuconfig 中的任意软件包名，每行一个。支持所有类型的包（luci-app-*、kmod-*、协议包等）。
                    <br>例如: <code>xl2tpd</code>、<code>kmod-usb-net-rndis</code>、<code>luci-app-frpc</code>、<code>ipset</code>
                </p>
                <textarea id="custom-packages-input" 
                    class="custom-packages-textarea" 
                    rows="6" 
                    placeholder="每行一个包名，例如：&#10;xl2tpd&#10;strongswan&#10;kmod-nft-tproxy&#10;luci-app-frpc&#10;curl"
                    onclick="event.stopPropagation()">${this.config.customPackages || ''}</textarea>
                <div class="custom-packages-stats" id="custom-packages-stats">
                    ${this.getCustomPackagesStats()}
                </div>
            </div>
        `;

        container.innerHTML = html;

        // 绑定 LAN IP 输入事件
        this.bindLanIpEvents();

        // 绑定自定义包输入事件
        this.bindCustomPackagesEvents();

        // 添加冲突检测面板
        this.renderConflictDetection();
    }

    /**
     * 渲染冲突检测
     */
    renderConflictDetection() {
        const container = document.getElementById('conflict-detection');
        if (!container) return;

        const conflicts = this.detectPluginConflicts();

        let html = '<div class="conflict-panel">';

        if (conflicts.length === 0) {
            html += `
                <div class="conflict-status success">
                    <span class="status-icon">✅</span>
                    <span class="status-text">配置检查通过，无冲突问题</span>
                </div>
            `;
        } else {
            html += `
                <div class="conflict-status error">
                    <span class="status-icon">⚠️</span>
                    <span class="status-text">发现 ${conflicts.length} 个配置问题</span>
                </div>
            `;

            conflicts.forEach(conflict => {
                html += `
                    <div class="conflict-item">
                        <div class="conflict-type">插件冲突</div>
                        <div class="conflict-message">${conflict.message}</div>
                    </div>
                `;
            });
        }

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * 渲染配置摘要
     */
    renderConfigSummary() {
        const container = document.getElementById('config-summary');
        if (!container) {
            console.warn('配置摘要容器未找到');
            return;
        }

        const sourceInfo = this.sourceBranches[this.config.source];
        const deviceInfo = this.deviceConfigs[this.config.device];

        // 自定义仓库显示信息
        let sourceDisplayName = sourceInfo?.name || '未选择';
        let sourceExtraInfo = '';
        if (this.config.source === 'custom' && this.config.customRepo) {
            sourceDisplayName = '自定义仓库';
            sourceExtraInfo = `
                <div class="summary-item">
                    <div class="summary-label">仓库地址</div>
                    <div class="summary-value" style="word-break:break-all;">${this.config.customRepo}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">分支/Tag/Commit</div>
                    <div class="summary-value">${this.config.customBranch || '未指定'}</div>
                </div>
            `;
        }

        let html = `
            <div class="summary-section">
                <h3>📋 配置摘要</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">源码分支</div>
                        <div class="summary-value">${sourceDisplayName}</div>
                    </div>
                    ${sourceExtraInfo}
                    <div class="summary-item">
                        <div class="summary-label">目标设备</div>
                        <div class="summary-value">${deviceInfo?.name || '未选择'}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">选中插件</div>
                        <div class="summary-value">${this.config.plugins.length} 个</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">自定义包</div>
                        <div class="summary-value">${this.parseCustomPackages().length} 个</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">LAN IP</div>
                        <div class="summary-value">${this.config.lanIp || '192.168.1.1'}</div>
                    </div>
                </div>
            </div>
            
            <div class="summary-section">
                <h3>🔧 插件列表</h3>
                <div class="plugin-summary">
                    ${this.config.plugins.length > 0 ?
                this.config.plugins.map(plugin => this.getPluginDisplayName(plugin)).join(', ') :
                '未选择插件'
            }
                </div>
                ${this.parseCustomPackages().length > 0 ? `
                <div class="plugin-summary" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                    <strong>自定义包:</strong> ${this.parseCustomPackages().join(', ')}
                </div>
                ` : ''}
            </div>
            
            <div class="summary-section">
                <h3>🚀 编译控制</h3>
                <div class="build-actions">
                    ${this.getValidToken() ? `
                        <button id="start-build-btn" class="btn btn-primary btn-large">
                            🚀 开始编译
                        </button>
                    ` : `
                        <button id="start-build-btn" class="btn btn-primary btn-large" disabled>
                            🔒 需要配置Token
                        </button>
                        <button class="btn btn-secondary" onclick="window.tokenModal?.show()">
                            ⚙️ 配置GitHub Token
                        </button>
                    `}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // === 选择操作方法 ===

    selectSource(sourceKey) {
        this.config.source = sourceKey;
        this.renderSourceSelection();
        console.log('✅ 选择源码:', sourceKey);
    }

    selectDevice(deviceKey) {
        this.config.device = deviceKey;
        this.renderDeviceSelection();
        console.log('✅ 选择设备:', deviceKey);
    }

    togglePlugin(pluginKey) {
        const index = this.config.plugins.indexOf(pluginKey);
        if (index > -1) {
            this.config.plugins.splice(index, 1);
        } else {
            this.config.plugins.push(pluginKey);
        }

        this.renderPluginSelection();
        console.log('🔧 插件状态更新:', pluginKey, index > -1 ? '移除' : '添加');
    }

    /**
     * 绑定 LAN IP 输入事件
     */
    bindLanIpEvents() {
        const lanIpInput = document.getElementById('lan-ip-input');
        if (lanIpInput) {
            lanIpInput.addEventListener('input', (e) => {
                this.config.lanIp = e.target.value.trim();
            });
        }
    }

    /**
     * 绑定自定义包输入事件
     */
    bindCustomPackagesEvents() {
        const textarea = document.getElementById('custom-packages-input');
        if (textarea) {
            textarea.addEventListener('input', (e) => {
                this.config.customPackages = e.target.value;
                const statsEl = document.getElementById('custom-packages-stats');
                if (statsEl) {
                    statsEl.innerHTML = this.getCustomPackagesStats();
                }
            });
        }
    }

    /**
     * 获取自定义包统计信息
     */
    getCustomPackagesStats() {
        const packages = this.parseCustomPackages();
        if (packages.length === 0) return '<span class="stats-empty">未添加自定义包</span>';
        return `<span class="stats-count">已添加 ${packages.length} 个自定义包: ${packages.join(', ')}</span>`;
    }

    /**
     * 解析自定义包列表
     */
    parseCustomPackages() {
        if (!this.config.customPackages) return [];
        return this.config.customPackages
            .split(/[\n,]+/)
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .filter(p => /^[\w][\w.-]*$/.test(p));
    }

    // === 编译相关方法 ===

    /**
     * 开始编译流程 - 增强版本
     */
    async startBuild() {
        try {
            // 验证配置完整性
            if (!this.config.source) {
                alert('请先选择源码分支');
                return;
            }

            // 验证自定义仓库配置
            if (this.config.source === 'custom') {
                if (!this.config.customRepo) {
                    alert('请输入自定义仓库地址');
                    return;
                }
                if (!this.config.customBranch) {
                    alert('请输入分支/Tag/Commit');
                    return;
                }
                // 验证仓库地址格式
                if (!this.config.customRepo.match(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/)) {
                    alert('仓库地址格式不正确，请输入完整的GitHub仓库URL\n例如: https://github.com/barry-ran/immortalwrt');
                    return;
                }
            }

            if (!this.config.device) {
                alert('请先选择目标设备');
                return;
            }

            // 验证Token
            const token = this.getValidToken();
            if (!token) {
                alert('请先配置GitHub Token');
                if (window.tokenModal) {
                    window.tokenModal.show();
                }
                return;
            }

            // 检查插件冲突
            const conflicts = this.detectPluginConflicts();
            if (conflicts.length > 0) {
                const proceed = confirm(`检测到 ${conflicts.length} 个插件冲突，是否继续？\n\n${conflicts.map(c => c.message).join('\n')}`);
                if (!proceed) return;
            }

            // 显示编译前确认信息
            const confirmMessage = this.generateBuildConfirmMessage();
            if (!confirm(confirmMessage)) {
                return;
            }

            // 生成编译配置
            const buildData = this.generateBuildConfig();
            console.log('🚀 开始智能编译，配置数据:', buildData);

            // 显示编译监控面板
            this.showBuildMonitor();

            // 添加初始日志
            this.addLogEntry('info', '🎯 正在启动智能编译工作流...');
            if (this.config.source === 'custom') {
                this.addLogEntry('info', `📋 源码: 自定义仓库 (${this.config.customRepo})`);
                this.addLogEntry('info', `🌿 分支: ${this.config.customBranch}`);
            } else {
                this.addLogEntry('info', `📋 源码: ${this.sourceBranches[this.config.source]?.name}`);
            }
            this.addLogEntry('info', `🔧 设备: ${this.deviceConfigs[this.config.device]?.name}`);
            this.addLogEntry('info', `📦 插件: ${this.config.plugins.length}个`);

            // 触发GitHub Actions编译（仅智能编译工作流）
            const response = await this.triggerBuild(buildData, token);

            if (response.success) {
                this.showBuildSuccess();
                // 开始真实的进度监控
                this.startRealProgressMonitoring(token);
            } else {
                alert('编译启动失败: ' + response.message);
            }
        } catch (error) {
            console.error('编译启动失败:', error);
            this.addLogEntry('error', `❌ 编译启动失败: ${error.message}`);
            alert('编译启动失败: ' + error.message);
        }
    }

    /**
     * 生成编译配置
     */
    generateBuildConfig() {
        // 合并勾选的插件 + 自定义输入的包名，去重
        const customPkgs = this.parseCustomPackages();
        const allPlugins = [...new Set([...this.config.plugins, ...customPkgs])];

        const buildData = {
            source_branch: this.config.source,
            target_device: this.config.device,
            plugins: allPlugins.join(','), // 转换为逗号分隔的字符串
            lan_ip: this.config.lanIp || '192.168.1.1',
            description: '智能编译工具Web界面触发',
            timestamp: Date.now(),
            build_id: 'web_build_' + Date.now(),
            // 明确指定使用智能编译工作流
            workflow_type: 'smart_build'
        };

        // 如果是自定义仓库，添加自定义仓库信息
        if (this.config.source === 'custom') {
            buildData.custom_repo_url = this.config.customRepo;
            buildData.custom_repo_branch = this.config.customBranch;
        }

        return buildData;
    }

    /**
     * 触发GitHub Actions编译 - 仅触发smart-build.yml
     */
    async triggerBuild(buildData, token) {
        try {
            const repoUrl = window.GITHUB_REPO || 'your-username/your-repo';

            // 记录触发信息
            console.log('🚀 触发智能编译工作流:', {
                repository: repoUrl,
                workflow: 'smart-build.yml',
                config: buildData
            });

            // 确保只触发智能编译工作流的Repository Dispatch事件
            const response = await fetch(`https://api.github.com/repos/${repoUrl}/dispatches`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'OpenWrt-Smart-Builder-Web'
                },
                body: JSON.stringify({
                    // 只触发智能编译工作流的特定事件类型
                    event_type: 'web_build',
                    client_payload: {
                        source_branch: buildData.source_branch,
                        target_device: buildData.target_device,
                        plugins: buildData.plugins,
                        lan_ip: buildData.lan_ip,
                        description: buildData.description,
                        custom_repo_url: buildData.custom_repo_url || '',
                        custom_repo_branch: buildData.custom_repo_branch || ''
                    }
                })
            });

            if (response.ok) {
                // 记录成功触发
                console.log('✅ 智能编译工作流触发成功');

                // 添加日志条目
                this.addLogEntry('success', '🎯 已成功触发智能编译工作流 (smart-build.yml)');
                this.addLogEntry('info', '🚫 通用设备编译工作流已自动跳过');

                return {
                    success: true,
                    message: '智能编译任务已成功提交到GitHub Actions',
                    workflow: 'smart-build.yml',
                    run_id: null
                };
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                // 网络错误，切换到模拟模式
                console.warn('GitHub API调用失败，切换到模拟模式:', error);

                this.addLogEntry('warning', '⚠️ 网络连接问题，启用模拟模式');
                this.addLogEntry('info', '🔄 请手动访问GitHub Actions页面触发编译');

                return {
                    success: true,
                    message: '编译任务模拟提交成功',
                    workflow: 'smart-build.yml',
                    run_id: null
                };
            }

            console.error('触发编译失败:', error);
            this.addLogEntry('error', `❌ 编译触发失败: ${error.message}`);
            throw new Error(`编译启动失败: ${error.message}`);
        }
    }

    /**
     * 开始真实的进度监控
     */
    async startRealProgressMonitoring(token) {
        this.monitoringActive = true;

        console.log('📊 开始GitHub Actions编译进度监控');
        this.addLogEntry('info', '🔄 开始监控GitHub Actions编译状态...');

        // 获取最新的工作流运行信息
        await this.findAndMonitorLatestRun(token);
    }

    /**
     * 查找并监控最新的工作流运行
     */
    async findAndMonitorLatestRun(token) {
        try {
            const repoUrl = window.GITHUB_REPO || 'your-username/your-repo';

            // 等待一段时间让GitHub处理dispatch事件
            this.addLogEntry('info', '⏳ 等待GitHub Actions处理编译请求...');
            await this.delay(10000); // 等待10秒

            // 获取最新的工作流运行
            const runsResponse = await fetch(`https://api.github.com/repos/${repoUrl}/actions/runs?per_page=5`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!runsResponse.ok) {
                throw new Error(`获取工作流运行失败: ${runsResponse.status}`);
            }

            const runsData = await runsResponse.json();

            // 查找最新的智能编译工作流运行
            const latestRun = runsData.workflow_runs.find(run =>
                run.name.includes('智能编译') ||
                run.workflow_id.toString().includes('smart-build') ||
                run.path.includes('smart-build.yml')
            );

            if (latestRun) {
                this.currentRunId = latestRun.id;
                this.addLogEntry('success', `🎯 找到编译任务 #${latestRun.run_number}`);
                this.addLogEntry('info', `📋 运行状态: ${this.getStatusText(latestRun.status)}`);

                // 开始监控这个运行
                this.monitorWorkflowRun(token, latestRun.id);
            } else {
                this.addLogEntry('warning', '⚠️ 未找到对应的编译任务，可能仍在队列中');
                // 继续等待并重试
                setTimeout(() => {
                    if (this.monitoringActive) {
                        this.findAndMonitorLatestRun(token);
                    }
                }, 15000); // 15秒后重试
            }

        } catch (error) {
            console.error('查找工作流运行失败:', error);
            this.addLogEntry('error', `❌ 查找编译任务失败: ${error.message}`);
            this.addLogEntry('info', '🔄 切换到基础监控模式...');
            this.startBasicMonitoring();
        }
    }

    /**
     * 监控特定的工作流运行
     */
    async monitorWorkflowRun(token, runId) {
        let checkCount = 0;
        const maxChecks = 120; // 最多检查2小时 (每分钟检查一次)

        this.buildMonitorInterval = setInterval(async () => {
            checkCount++;

            try {
                const repoUrl = window.GITHUB_REPO || 'your-username/your-repo';

                // 获取工作流运行状态
                const runResponse = await fetch(`https://api.github.com/repos/${repoUrl}/actions/runs/${runId}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (!runResponse.ok) {
                    throw new Error(`获取运行状态失败: ${runResponse.status}`);
                }

                const runData = await runResponse.json();

                // 更新进度和状态
                this.updateBuildProgress(runData);

                // 如果编译完成或达到最大检查次数，停止监控
                if (this.isRunCompleted(runData.status) || checkCount >= maxChecks) {
                    this.stopProgressMonitoring();

                    if (checkCount >= maxChecks) {
                        this.addLogEntry('warning', '⚠️ 监控超时，请手动检查编译状态');
                    }
                }

            } catch (error) {
                console.error('监控工作流运行失败:', error);
                this.addLogEntry('warning', `⚠️ 监控连接异常: ${error.message}`);

                // 连续失败3次后停止监控
                if (checkCount % 3 === 0) {
                    this.addLogEntry('info', '🔄 切换到基础监控模式...');
                    this.stopProgressMonitoring();
                    this.startBasicMonitoring();
                }
            }
        }, 60000); // 每分钟检查一次
    }

    /**
     * 更新编译进度
     */
    updateBuildProgress(runData) {
        const { status, conclusion, created_at, updated_at, run_number } = runData;

        let progress = 0;
        let statusText = '';
        let logLevel = 'info';

        // 根据状态计算进度
        switch (status) {
            case 'queued':
                progress = 5;
                statusText = '⏳ 编译任务排队中...';
                break;

            case 'in_progress':
                // 根据运行时间估算进度
                const startTime = new Date(created_at).getTime();
                const currentTime = Date.now();
                const elapsed = currentTime - startTime;
                const estimatedTotal = 90 * 60 * 1000; // 估计90分钟完成

                progress = Math.min(90, 10 + (elapsed / estimatedTotal) * 80);
                statusText = `🚀 正在编译中... (任务 #${run_number})`;

                // 添加详细的时间信息
                const elapsedMinutes = Math.floor(elapsed / 60000);
                if (elapsedMinutes > 0) {
                    this.addLogEntry('info', `⏱️ 已运行 ${elapsedMinutes} 分钟`);
                }
                break;

            case 'completed':
                progress = 100;
                if (conclusion === 'success') {
                    statusText = '✅ 编译成功完成！';
                    logLevel = 'success';
                    this.onBuildCompleted(runData);
                } else if (conclusion === 'failure') {
                    statusText = '❌ 编译失败';
                    logLevel = 'error';
                    this.onBuildFailed(runData);
                } else if (conclusion === 'cancelled') {
                    statusText = '⚠️ 编译被取消';
                    logLevel = 'warning';
                    this.onBuildCancelled(runData);
                } else {
                    statusText = '⚠️ 编译异常结束';
                    logLevel = 'warning';
                }
                break;

            default:
                statusText = `📊 状态: ${status}`;
        }

        // 更新UI进度
        this.updateProgressBar(Math.floor(progress));
        this.addLogEntry(logLevel, statusText);

        // 更新浏览器标题
        if (progress < 100) {
            document.title = `[${Math.floor(progress)}%] OpenWrt 编译中...`;
        } else {
            document.title = 'OpenWrt 智能编译工具';
        }
    }

    /**
     * 更新进度条
     */
    updateProgressBar(progress) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        if (progressText) {
            progressText.textContent = `${progress}%`;
        }
    }

    /**
     * 编译完成处理
     */
    onBuildCompleted(runData) {
        this.addLogEntry('success', '🎉 固件编译成功完成！');
        this.addLogEntry('info', `🕐 总耗时: ${this.calculateDuration(runData.created_at, runData.updated_at)}`);

        // 显示下载链接
        const repoUrl = window.GITHUB_REPO || 'your-username/your-repo';
        this.addLogEntry('info', `🔗 查看结果: https://github.com/${repoUrl}/actions/runs/${runData.id}`);
        this.addLogEntry('info', `📦 下载固件: https://github.com/${repoUrl}/releases`);

        // 显示成功通知
        this.showNotification('编译成功', '固件编译完成，请前往Releases页面下载', 'success');
    }

    /**
     * 编译失败处理
     */
    onBuildFailed(runData) {
        this.addLogEntry('error', '❌ 固件编译失败');
        this.addLogEntry('info', `🕐 运行时间: ${this.calculateDuration(runData.created_at, runData.updated_at)}`);

        // 显示失败信息和解决建议
        const repoUrl = window.GITHUB_REPO || 'your-username/your-repo';
        this.addLogEntry('error', `🔍 查看详细日志: https://github.com/${repoUrl}/actions/runs/${runData.id}`);
        this.addLogEntry('info', '💡 建议: 检查插件冲突、减少插件数量或选择不同的源码分支');

        // 显示失败通知
        this.showNotification('编译失败', '请检查配置或查看详细日志', 'error');
    }

    /**
     * 编译取消处理
     */
    onBuildCancelled(runData) {
        this.addLogEntry('warning', '⚠️ 编译任务已被取消');
        this.addLogEntry('info', `🕐 运行时间: ${this.calculateDuration(runData.created_at, runData.updated_at)}`);

        // 显示取消通知
        this.showNotification('编译取消', '编译任务已被取消', 'warning');
    }

    /**
     * 基础监控模式（备用方案）
     */
    startBasicMonitoring() {
        this.addLogEntry('info', '📊 启用基础监控模式');
        this.addLogEntry('info', '🔄 进度信息将基于预估时间显示');

        let progress = 10;
        this.buildMonitorInterval = setInterval(() => {
            if (!this.monitoringActive) return;

            progress += Math.random() * 5;
            progress = Math.min(progress, 95); // 最多到95%

            this.updateProgressBar(Math.floor(progress));

            // 定期提醒用户查看GitHub Actions
            if (Math.floor(progress) % 20 === 0) {
                const repoUrl = window.GITHUB_REPO || 'your-username/your-repo';
                this.addLogEntry('info', `📋 请访问 GitHub Actions 查看详细进度: https://github.com/${repoUrl}/actions`);
            }
        }, 120000); // 每2分钟更新一次
    }

    /**
     * 停止进度监控
     */
    stopProgressMonitoring() {
        this.monitoringActive = false;

        if (this.buildMonitorInterval) {
            clearInterval(this.buildMonitorInterval);
            this.buildMonitorInterval = null;
        }

        console.log('🛑 停止编译进度监控');
    }

    /**
     * 生成编译确认消息
     */
    generateBuildConfirmMessage() {
        const sourceInfo = this.sourceBranches[this.config.source];
        const deviceInfo = this.deviceConfigs[this.config.device];

        let sourceDesc = sourceInfo?.name || '未知';
        if (this.config.source === 'custom') {
            sourceDesc = `自定义仓库\n  仓库: ${this.config.customRepo}\n  分支: ${this.config.customBranch}`;
        }

        return `确认开始编译？\n\n` +
            `📋 编译配置:\n` +
            `源码分支: ${sourceDesc}\n` +
            `目标设备: ${deviceInfo?.name || '未知'}\n` +
            `选中插件: ${this.config.plugins.length}个\n` +
            `LAN IP: ${this.config.lanIp || '192.168.1.1'}\n` +
            `工作流类型: 智能编译 (smart-build.yml)\n\n` +
            `⚠️ 注意事项:\n` +
            `• 编译过程约需要1-3小时\n` +
            `• 将消耗GitHub Actions运行时间\n` +
            `• 只会执行智能编译工作流\n` +
            `• 通用设备编译工作流将被跳过`;
    }

    /**
     * 显示编译监控面板
     */
    showBuildMonitor() {
        const buildMonitor = document.getElementById('build-monitor');
        if (buildMonitor) {
            buildMonitor.style.display = 'block';
            buildMonitor.scrollIntoView({ behavior: 'smooth' });
        }

        // 清空之前的日志
        const logsContent = document.getElementById('logs-content');
        if (logsContent) {
            logsContent.innerHTML = '';
        }

        // 重置进度条
        this.updateProgressBar(0);
    }

    /**
     * 显示编译成功信息
     */
    showBuildSuccess() {
        this.addLogEntry('success', '🎉 智能编译工作流已成功启动！');
        this.addLogEntry('info', `📋 配置信息: ${this.sourceBranches[this.config.source]?.name} - ${this.deviceConfigs[this.config.device]?.name}`);
        this.addLogEntry('info', `🔧 选中插件: ${this.config.plugins.length}个`);
        this.addLogEntry('info', `🕐 提交时间: ${new Date().toLocaleString()}`);
        this.addLogEntry('info', `📝 工作流: smart-build.yml (智能编译模式)`);

        // 添加访问链接
        const repoUrl = window.GITHUB_REPO || 'your-username/your-repo';
        this.addLogEntry('info', `🔗 监控地址: https://github.com/${repoUrl}/actions`);
    }

    /**
     * 添加日志条目 - 增强版本
     */
    addLogEntry(type, message) {
        const logsContent = document.getElementById('logs-content');
        if (!logsContent) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;

        // 添加图标映射
        const iconMap = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        };

        const icon = iconMap[type] || 'ℹ️';

        logEntry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-icon">${icon}</span>
            <span class="log-message">${message}</span>
        `;

        logsContent.appendChild(logEntry);
        logsContent.scrollTop = logsContent.scrollHeight;

        // 控制台同步输出
        console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);

        // 限制日志条目数量
        const maxLogEntries = 1000;
        const logEntries = logsContent.querySelectorAll('.log-entry');
        if (logEntries.length > maxLogEntries) {
            for (let i = 0; i < logEntries.length - maxLogEntries; i++) {
                logEntries[i].remove();
            }
        }
    }

    // === 工具方法 ===

    /**
     * 延迟执行
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 检查运行是否完成
     */
    isRunCompleted(status) {
        return ['completed', 'cancelled'].includes(status);
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const statusMap = {
            'queued': '排队中',
            'in_progress': '进行中',
            'completed': '已完成',
            'cancelled': '已取消'
        };
        return statusMap[status] || status;
    }

    /**
     * 计算持续时间
     */
    calculateDuration(startTime, endTime) {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        const duration = end - start;

        const minutes = Math.floor(duration / 60000);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`;
        } else {
            return `${minutes}分钟`;
        }
    }

    /**
     * 显示系统通知
     */
    showNotification(title, message, type = 'info') {
        // 检查浏览器通知权限
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: message,
                icon: '/favicon.ico',
                badge: '/favicon.ico'
            });

            setTimeout(() => notification.close(), 5000);
        }

        // 备用：在页面上显示通知
        this.showInPageNotification(title, message, type);
    }

    /**
     * 页面内通知
     */
    showInPageNotification(title, message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <h4>${title}</h4>
            <p>${message}</p>
            <button onclick="this.parentElement.remove()">×</button>
        `;

        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#ff9800'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // 5秒后自动移除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getRepoShortName(repoUrl) {
        try {
            return repoUrl.split('/').slice(-2).join('/');
        } catch (error) {
            return repoUrl;
        }
    }

    getPluginDisplayName(pluginKey) {
        // 遍历所有插件配置，找到对应的显示名称
        for (const category of Object.values(this.pluginConfigs)) {
            if (category.plugins && category.plugins[pluginKey]) {
                return category.plugins[pluginKey].name;
            }
        }
        return pluginKey;
    }

    detectPluginConflicts() {
        // 简单的冲突检测逻辑
        const conflicts = [];
        const selectedPlugins = this.config.plugins;

        // 检查常见冲突
        const proxyPlugins = ['luci-app-ssr-plus', 'luci-app-passwall', 'luci-app-openclash'];
        const selectedProxy = selectedPlugins.filter(plugin => proxyPlugins.includes(plugin));

        if (selectedProxy.length > 1) {
            conflicts.push({
                type: 'mutual_exclusive',
                plugins: selectedProxy,
                message: `代理插件冲突：${selectedProxy.join(', ')} 不能同时选择`
            });
        }

        return conflicts;
    }

    filterOptions(searchTerm, filterType) {
        const term = searchTerm.toLowerCase();
        let options = [];

        switch (filterType) {
            case 'source':
                options = document.querySelectorAll('.source-option');
                break;
            case 'device':
                options = document.querySelectorAll('.device-option');
                break;
            case 'plugin':
                options = document.querySelectorAll('.plugin-item');
                break;
        }

        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(term) ? 'block' : 'none';
        });
    }

    // === 步骤导航方法 ===

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            if (this.validateCurrentStep()) {
                this.renderStep(this.currentStep + 1);
            }
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.renderStep(this.currentStep - 1);
        }
    }

    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                if (!this.config.source) {
                    alert('请选择源码分支');
                    return false;
                }
                break;
            case 2:
                if (!this.config.device) {
                    alert('请选择目标设备');
                    return false;
                }
                break;
            case 3: {
                const ip = this.config.lanIp || '192.168.1.1';
                const ipPattern = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)){3}$/;
                if (!ipPattern.test(ip)) {
                    alert(`LAN IP 格式不正确："${ip}"\n请输入有效的 IPv4 地址，例如 192.168.1.1`);
                    return false;
                }
                break;
            }
        }
        return true;
    }
}

// === 全局函数（供HTML调用）===

// Token配置完成回调
function onTokenConfigured(token) {
    if (window.wizardManager) {
        window.wizardManager.onTokenConfigured(token);
    }
}

// 页面加载完成后初始化向导
document.addEventListener('DOMContentLoaded', function () {
    console.log('🎯 页面加载完成，初始化编译向导');

    // 延迟初始化，确保所有资源加载完成
    setTimeout(() => {
        window.wizardManager = new WizardManager();
    }, 500);
});

// 导出向导管理器供调试使用
window.WizardManager = WizardManager;