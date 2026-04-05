document.addEventListener("DOMContentLoaded", function () {
    initCaseDetail();
});

async function initCaseDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const caseId = urlParams.get('id');

    if (!caseId) {
        console.warn("URL中缺少 id 参数，无法加载详情");
        return;
    }

    try {
        // 2. 调用真实的后端 RESTful 详情接口
        const res = await requestApi('/api/projectCase/detail/' + caseId);
        const rawData = res.data || res.result || res;

        const caseData = normalizeDetailData(rawData);
        console.log(caseData)
        // 4. 收集所有需要去换取真实 URL 的图片 ID (包含头图和正文配图)
        const fileIdsToFetch = [];
        if (caseData.bannerImageId) fileIdsToFetch.push(caseData.bannerImageId);
        if (caseData.details && caseData.details.length) {
            caseData.details.forEach(item => {
                if (item.imageId) fileIdsToFetch.push(item.imageId);
            });
        }

        // 5. 批量调用接口，将 fileId 换成真实的 URL
        let urlMap = {};
        const uniqueFileIds = Array.from(new Set(fileIdsToFetch)).filter(id => id && !id.startsWith("http") && !id.startsWith("/"));

        if (uniqueFileIds.length > 0) {
            try {
                const chunkRes = await requestApi('/api/file/getFileTmpUrl?fileIds=' + uniqueFileIds.join(','));
                const chunkData = chunkRes.data || chunkRes.result || chunkRes;

                if (!Array.isArray(chunkData) && typeof chunkData === 'object') {
                    Object.assign(urlMap, chunkData);
                } else if (Array.isArray(chunkData)) {
                    chunkData.forEach((item, idx) => {
                        if (typeof item === 'string') {
                            urlMap[uniqueFileIds[idx]] = item;
                        } else if (item) {
                            const originId = item.id || item.fileId || uniqueFileIds[idx];
                            // 根据你们的后端逻辑取 tmpDownloadUrl 或 url
                            urlMap[originId] = item.tmpDownloadUrl || item.url || item.fileUrl || item.fileToken;
                        }
                    });
                }
            } catch (imgError) {
                console.error("详情页获取图片链接失败:", imgError);
            }
        }

        // 6. 开始渲染 DOM
        renderCaseBanner(caseData, urlMap);
        renderCaseContent(caseData, urlMap);
        document.getElementById('page-loading').style.display = 'none';
        document.getElementById('page-content').style.display = 'block';

    } catch (error) {
       console.error("加载案例详情失败:", error);
        const loadingWrapper = document.getElementById('page-loading');
        if(loadingWrapper) {
            loadingWrapper.innerHTML = '<p style="color: red;">抱歉，加载失败，请刷新重试</p>';
        }
    }
}

// ⚠️ 字段映射层：将后端接口实际返回的字段，转换为前端 DOM 渲染所需要的标准结构
function normalizeDetailData(raw) {
    if (!raw) return {};

    // 提取顶部头图 Token (适配你们常用的 contentImage 数组结构)
    let bannerToken = "";
    if (raw.contentImage && Array.isArray(raw.contentImage) && raw.contentImage.length > 0) {
        bannerToken = raw.titleBackgroundImage[0].fileToken;
    } else {
        bannerToken = raw.imageUrl || raw.cover || raw.image || "";
    }

    return {
        // 顶部区数据
        title: raw.projectName,
        description: raw.companyIntroduction,
        bannerImageId: bannerToken,
        metrics: normalizeCaseMetrics(raw),
        background: raw.customerBackground || raw.background || "",
        challenges: getChallenges(raw),

        // 图文详情模块（如果后端字段名叫别的，请修改这里）
        // 期望格式: [{ title: '大标题', content: '段落文本', imageId: '图片的fileId' }]
        details: getDetails(raw) || []
    };
}

function getChallenges(raw) {
    return [
        { title: '挑战一', desc: raw.challenge1, solutionTitle: '方案一', solutionDesc: raw.solution1 },
        { title: '挑战二', desc: raw.challenge2, solutionTitle: '方案二', solutionDesc: raw.solution2 },
    ]
}
function getDetails(raw) {
    return [
        { title: raw.sectionTitle1, content: raw.sectionContent1, imageId: raw.contentImage && raw.contentImage[0] ? raw.contentImage[0].fileToken : null },
        { title: raw.sectionTitle2, content: raw.sectionContent2,  },
    ]
}
function normalizeCaseMetrics(item) {
    return [{ value: item.metric1 * 100 + '%', label: item.metric1Label }, { value: item.metric2 * 100 + 'min', label: item.metric2Label }, { value: item.metric3 * 100 + '%', label: item.metric3Label }];
}
// 渲染顶部 Banner 区域
function renderCaseBanner(data, urlMap) {
    const titleEl = document.querySelector('.case-banner-title');
    const descEl = document.querySelector('.case-banner-desc');
    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.textContent = data.description;

    const bannerImgEl = document.querySelector('.case-banner-image');
    if (bannerImgEl) {
        // 如果 urlMap 里面没有，降级使用自身字段（可能是绝对路径），再降级使用默认图
        const realBgUrl = urlMap[data.bannerImageId] || data.bannerImageId || '/assets/images/1.jpg';
        bannerImgEl.style.backgroundImage = 'url("' + realBgUrl + '")';
    }

    const metricsContainer = document.querySelector('.case-metrics');
    if (metricsContainer) {
        metricsContainer.innerHTML = '';
        if (data.metrics && data.metrics.length > 0) {
            data.metrics.forEach(metric => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'case-metric-item';

                const valueDiv = document.createElement('div');
                valueDiv.className = 'case-metric-value';
                valueDiv.textContent = metric.value || metric.metricValue; // 兼容不同字段名

                const labelDiv = document.createElement('div');
                labelDiv.className = 'case-metric-label';
                labelDiv.textContent = metric.label || metric.metricName; // 兼容不同字段名

                itemDiv.appendChild(valueDiv);
                itemDiv.appendChild(labelDiv);
                metricsContainer.appendChild(itemDiv);
            });
        }
    }
}

// 动态渲染正文内容区域
function renderCaseContent(data, urlMap) {
    const wrapper = document.querySelector('.case-content-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // 1. 渲染客户背景
    if (data.background) {
        const bgTitle = document.createElement('h2');
        bgTitle.className = 'case-section-title';
        bgTitle.textContent = '客户背景';

        const bgDesc = document.createElement('p');
        bgDesc.className = 'case-paragraph';
        bgDesc.textContent = data.background;

        fragment.appendChild(bgTitle);
        fragment.appendChild(bgDesc);
    }

    // 2. 渲染挑战与解决方案
    if (data.challenges && data.challenges.length > 0) {
        data.challenges.forEach((item, index) => {
            const challengeBox = document.createElement('div');
            const themeColor = index % 2 === 0 ? 'purple' : 'cyan';
            challengeBox.className = 'case-challenge-box box-' + themeColor;

            const colLeft = document.createElement('div');
            colLeft.className = 'challenge-col-left';
            colLeft.innerHTML = `
                <h3 class="challenge-title text-${themeColor}">${item.title || '挑战'}</h3>
                <div class="challenge-desc">${item.desc || ''}</div>
            `;

            const iconWrap = document.createElement('div');
            iconWrap.className = 'challenge-icon';
            const arrowImg = themeColor === 'purple' ? '/assets/images/right1.svg' : '/assets/images/right2.svg';
            iconWrap.innerHTML = `<img src="${arrowImg}" alt="转化为" />`;

            const colRight = document.createElement('div');
            colRight.className = 'challenge-col-right';
            colRight.innerHTML = `
                <h3 class="challenge-title text-${themeColor}">${item.solutionTitle || '解决方案'}</h3>
                <div class="challenge-desc">${item.solutionDesc || ''}</div>
            `;

            challengeBox.appendChild(colLeft);
            challengeBox.appendChild(iconWrap);
            challengeBox.appendChild(colRight);
            fragment.appendChild(challengeBox);
        });
    }

    // 3. 渲染图文详情模块
    if (data.details && data.details.length > 0) {
        data.details.forEach(item => {
            // 有标题才渲染标题
            if (item.title) {
                const detailTitle = document.createElement('h2');
                detailTitle.className = 'case-section-title spacing-top';
                detailTitle.textContent = item.title;
                fragment.appendChild(detailTitle);
            }

            // 有内容才渲染文本
            if (item.content) {
                const detailDesc = document.createElement('p');
                detailDesc.className = 'case-paragraph';
                detailDesc.textContent = item.content;
                fragment.appendChild(detailDesc);
            }

            // 如果有图片 ID 才去换取渲染图片节点
            if (item.imageId || item.imageToken || item.cover) {
                const sourceId = item.imageId || item.imageToken || item.cover;
                const realImgUrl = urlMap[sourceId] || sourceId || '/assets/images/1.jpg';
                const detailImg = document.createElement('img');
                detailImg.className = 'case-detail-image';
                detailImg.src = realImgUrl;
                detailImg.alt = item.title || '详情图片';
                fragment.appendChild(detailImg);
            }
        });
    }

    wrapper.appendChild(fragment);
}

// ==========================================
// 公共请求方法 (如果你已经在 index.js 全局挂载了，可以把下面这段删掉)
// ==========================================
function requestApi(url, options) {
    const requestOptions = Object.assign(
        { method: "GET", headers: { Accept: "application/json" } },
        options || {}
    );
    const params = Object.assign({}, requestOptions.params || {});
    const method = (requestOptions.method || "GET").toUpperCase();
    delete requestOptions.params;
    let requestUrl = url;

    if (method === "GET") {
        const query = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== "") {
                query.set(key, params[key]);
            }
        });
        if (query.toString()) {
            requestUrl += (requestUrl.indexOf("?") === -1 ? "?" : "&") + query.toString();
        }
    } else if (!requestOptions.body && Object.keys(params).length) {
        requestOptions.headers["Content-Type"] = "application/json";
        requestOptions.body = JSON.stringify(params);
    }

    return fetch(requestUrl, requestOptions).then(function (response) {
        if (!response.ok) throw new Error("Request failed with status " + response.status);
        const contentType = response.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") !== -1) return response.json();
        return response.text();
    });
}