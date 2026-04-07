document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initLeadForm();
    initSolutionModal();
    void initCaseDetail();
    const modal1 = document.getElementById('successModal');
    window.openSuccessModal = function () {
        modal1.classList.add('is-active');
        document.body.style.overflow = 'hidden';
    }
    window.closeSuccessModal = function () {
        modal1.classList.remove('is-active');
        document.body.style.overflow = '';
    }
});

function initHeader() {
    const header = document.getElementById("header");
    const menuToggle = header ? header.querySelector(".header-menu-toggle") : null;
    const mobileMenuQuery = window.matchMedia("(max-width: 768px)");

    if (!header) {
        return;
    }

    const setMenuState = function (isOpen) {
        header.classList.toggle("menu-open", isOpen);
        document.body.classList.toggle("mobile-menu-open", isOpen && mobileMenuQuery.matches);

        if (menuToggle) {
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute("aria-label", isOpen ? "收起导航菜单" : "打开导航菜单");
        }
    };

    const closeMenu = function () {
        setMenuState(false);
    };

    const syncHeaderState = function () {
        header.classList.toggle("scrolled", window.scrollY > 24);

        if (!header.classList.contains("menu-open")) {
            document.body.classList.remove("mobile-menu-open");
        }
    };

    window.addEventListener("scroll", syncHeaderState, { passive: true });

    if (menuToggle) {
        menuToggle.addEventListener("click", function () {
            setMenuState(!header.classList.contains("menu-open"));
        });

        header.querySelectorAll(".nav a").forEach(function (link) {
            link.addEventListener("click", closeMenu);
        });

        header.querySelectorAll(".header-actions > .btn").forEach(function (button) {
            button.addEventListener("click", closeMenu);
        });

        document.addEventListener("click", function (event) {
            if (!mobileMenuQuery.matches || !header.classList.contains("menu-open")) {
                return;
            }

            if (!header.contains(event.target)) {
                closeMenu();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeMenu();
            }
        });

        window.addEventListener(
            "resize",
            debounce(function () {
                if (!mobileMenuQuery.matches) {
                    closeMenu();
                }

                syncHeaderState();
            }, 120)
        );
    }

    setMenuState(false);
    syncHeaderState();
}

function initLeadForm() {
    document.querySelectorAll(".lead-gen-form").forEach(function (form) {
        const submitButton = form.querySelector(".btn-submit");
        const textInput = form.querySelector('input[type="text"]');
        const phoneInput = form.querySelector('input[type="tel"]');

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const nameValue = textInput ? textInput.value.trim() : "";
            const phoneValue = phoneInput ? phoneInput.value.trim() : "";
            const phoneReg = /^1[3-9]\d{9}$/;
            if (!phoneReg.test(phoneValue)) {
                alert("请输入正确的11位手机号。");
                return;
            }
            if (submitButton) {
                submitButton.textContent = "提交中...";
                submitButton.disabled = true;
            }

            requestApi("/api/mql/add", {
                method: "POST",
                body: {
                    companyFullName: nameValue,
                    phoneNumber: phoneValue,
                },
            })
                .then(function () {
                    form.reset();
                    openSuccessModal()
                })
                .catch(function (error) {
                    console.error("Lead form submit failed:", error);
                    alert("提交失败，请稍后再试。");
                })
                .finally(function () {
                    if (submitButton) {
                        submitButton.textContent = '立即预约';
                        submitButton.disabled = false;
                    }
                });
        });
    });
}

function initSolutionModal() {
    const modal = document.getElementById("solutionModal");
    const form = document.getElementById("solutionForm");
    const submitBtn = document.getElementById("submitBtn");
    const nameInput = document.getElementById("userName");
    const phoneInput = document.getElementById("userPhone");
    const messageInput = document.getElementById("userMessage");

    window.openSolutionModal = function () {
        if (!modal) {
            return;
        }

        modal.classList.add("is-active");
        document.body.style.overflow = "hidden";
    };

    window.closeSolutionModal = function () {
        if (!modal) {
            return;
        }

        modal.classList.remove("is-active");
        document.body.style.overflow = "";

        if (form) {
            window.setTimeout(function () {
                form.reset();
            }, 300);
        }
    };

    if (!form || !submitBtn || !nameInput || !phoneInput || !messageInput) {
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const nameValue = nameInput.value.trim();
        const phoneValue = phoneInput.value.trim();
        const messageValue = messageInput.value.trim();
        const phoneReg = /^1[3-9]\d{9}$/;
        const originalText = submitBtn.textContent;

        if (!nameValue) {
            alert("请输入您的企业全称。");
            return;
        }

        if (!phoneReg.test(phoneValue)) {
            alert("请输入正确的11位手机号。");
            return;
        }

        submitBtn.textContent = "提交中...";
        submitBtn.disabled = true;

        requestApi("/api/mql/add", {
            method: "POST",
            body: {
                companyFullName: nameValue,
                phoneNumber: phoneValue,
                problemDescription: messageValue,
            },
        })
            .then(function () {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                closeSolutionModal();
                openSuccessModal()

            })
            .catch(function (error) {
                console.error("Modal submit failed:", error);
                alert("提交失败，请稍后再试。");
            })
            .finally(function () {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
    });
}

async function initCaseDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const caseId = urlParams.get("id");

    if (!caseId) {
        console.warn("Missing id parameter in detail page URL.");
        return;
    }

    try {
        const response = await requestApi("/api/projectCase/detail/" + encodeURIComponent(caseId));
        console.log(response)
        window.document.title = response.data.projectName + " - 专注企业级软件开发 | 轻搭云";
        const rawData = response && (response.data || response.result || response);
        const caseData = normalizeDetailData(rawData);
        const imageIdList = collectDetailImageIds(caseData);
        let urlMap = {};

        if (imageIdList.length) {
            try {
                const imageResponse = await requestApi("/api/file/getFileTmpUrl?fileIds=" + imageIdList.join(","));
                urlMap = normalizeDetailImageUrlMap(imageResponse);
            } catch (imageError) {
                console.error("Failed to resolve detail image urls:", imageError);
            }
        }

        renderCaseBanner(caseData, urlMap);
        renderCaseContent(caseData, urlMap);

        document.getElementById("page-loading").style.display = "none";
        document.getElementById("page-content").style.display = "block";
    } catch (error) {
        console.error("Failed to load case detail:", error);

        const loadingWrapper = document.getElementById("page-loading");

        if (loadingWrapper) {
            loadingWrapper.innerHTML = '<p style="color: red;">抱歉，加载失败，请刷新重试。</p>';
        }
    }
}

function normalizeDetailData(raw) {
    if (!raw || typeof raw !== "object") {
        return {
            category: "成功案例",
            title: "",
            description: "",
            bannerImageId: "",
            metrics: [],
            background: "",
            challenges: [],
            details: [],
        };
    }

    const titleBackgroundImages = Array.isArray(raw.titleBackgroundImage) ? raw.titleBackgroundImage : [];
    const detailImages = Array.isArray(raw.contentImage) ? raw.contentImage : [];

    return {
        category: raw.industry || raw.category || "成功案例",
        title: raw.projectName || raw.title || "",
        description: raw.companyIntroduction || raw.description || "",
        bannerImageId:
            (titleBackgroundImages[0] && titleBackgroundImages[0].fileToken) ||
            raw.imageUrl ||
            raw.cover ||
            raw.image ||
            "",
        metrics: normalizeCaseMetrics(raw),
        background: raw.customerBackground || raw.background || "",
        challenges: getChallenges(raw),
        details: getDetails(raw, detailImages),
    };
}

function collectDetailImageIds(data) {
    const ids = [];

    if (needsImageResolution(data.bannerImageId)) {
        ids.push(data.bannerImageId);
    }

    (data.details || []).forEach(function (item) {
        if (needsImageResolution(item.imageId)) {
            ids.push(item.imageId);
        }
    });

    return Array.from(new Set(ids));
}

function getChallenges(raw) {
    return [
        {
            title: "挑战一",
            desc: raw.challenge1,
            solutionTitle: "方案一",
            solutionDesc: raw.solution1,
        },
        {
            title: "挑战二",
            desc: raw.challenge2,
            solutionTitle: "方案二",
            solutionDesc: raw.solution2,
        },
    ].filter(function (item) {
        return Boolean(
            String(item.desc || "").trim() ||
            String(item.solutionDesc || "").trim()
        );
    });
}

function getDetails(raw, detailImages) {
    return [
        {
            title: raw.sectionTitle1,
            content: raw.sectionContent1,
            imageId: detailImages[0] ? detailImages[0].fileToken : "",
        },
        {
            title: raw.sectionTitle2,
            content: raw.sectionContent2,
            imageId: detailImages[1] ? detailImages[1].fileToken : "",
        },
    ].filter(function (item) {
        return Boolean(
            String(item.title || "").trim() ||
            String(item.content || "").trim() ||
            String(item.imageId || "").trim()
        );
    });
}

function normalizeCaseMetrics(item) {
    return [
        { value: formatMetricValue(item.metric1, "%"), label: item.metric1Label },
        { value: formatMetricValue(item.metric2, "min"), label: item.metric2Label },
        { value: formatMetricValue(item.metric3, "%"), label: item.metric3Label },
    ].filter(function (metric) {
        return Boolean(String(metric.value || "").trim() && String(metric.label || "").trim());
    });
}

function formatMetricValue(value, suffix) {
    return value * 100 + suffix;
}

function renderCaseBanner(data, urlMap) {
    const titleEl = document.querySelector(".case-banner-title");
    const descEl = document.querySelector(".case-banner-desc");
    const categoryEl = document.querySelector(".case-banner-tag");
    const bannerImgEl = document.querySelector(".case-banner-image");
    const metricsContainer = document.querySelector(".case-metrics");

    if (titleEl) {
        titleEl.textContent = data.title || "";
    }

    if (descEl) {
        descEl.textContent = data.description || "";
    }

    if (categoryEl) {
        const categoryText = String(data.category || "").trim();
        categoryEl.textContent = categoryText;
        categoryEl.hidden = !categoryText;
    }

    if (bannerImgEl) {
        const realBgUrl = resolveDetailImageUrl(data.bannerImageId, urlMap) || "/assets/images/1.jpg";
        bannerImgEl.style.backgroundImage = 'url("' + realBgUrl.replace(/"/g, '\\"') + '")';
    }

    if (metricsContainer) {
        metricsContainer.innerHTML = "";

        (data.metrics || []).forEach(function (metric) {
            const itemDiv = document.createElement("div");
            const valueDiv = document.createElement("div");
            const labelDiv = document.createElement("div");

            itemDiv.className = "case-metric-item";
            valueDiv.className = "case-metric-value";
            labelDiv.className = "case-metric-label";
            valueDiv.textContent = metric.value || "";
            labelDiv.textContent = metric.label || "";

            itemDiv.appendChild(valueDiv);
            itemDiv.appendChild(labelDiv);
            metricsContainer.appendChild(itemDiv);
        });
    }
}

function renderCaseContent(data, urlMap) {
    const wrapper = document.querySelector(".case-content-wrapper");

    if (!wrapper) {
        return;
    }

    wrapper.innerHTML = "";

    const fragment = document.createDocumentFragment();

    if (data.background) {
        const bgTitle = document.createElement("h2");
        const bgDesc = document.createElement("p");

        bgTitle.className = "case-section-title";
        bgTitle.textContent = "客户背景";
        bgDesc.className = "case-paragraph";
        bgDesc.textContent = data.background;

        fragment.appendChild(bgTitle);
        fragment.appendChild(bgDesc);
    }

    (data.challenges || []).forEach(function (item, index) {
        const themeColor = index % 2 === 0 ? "purple" : "cyan";
        const challengeBox = document.createElement("div");
        const colLeft = document.createElement("div");
        const iconWrap = document.createElement("div");
        const colRight = document.createElement("div");
        const arrowImg = themeColor === "purple" ? "/assets/images/right1.svg" : "/assets/images/right2.svg";

        challengeBox.className = "case-challenge-box box-" + themeColor;
        colLeft.className = "challenge-col-left";
        iconWrap.className = "challenge-icon";
        colRight.className = "challenge-col-right";

        colLeft.innerHTML =
            '<h3 class="challenge-title text-' +
            themeColor +
            '">' +
            (item.title || "挑战") +
            '</h3><div class="challenge-desc">' +
            (item.desc || "") +
            "</div>";
        iconWrap.innerHTML = '<img src="' + arrowImg + '" alt="转化箭头" />';
        colRight.innerHTML =
            '<h3 class="challenge-title text-' +
            themeColor +
            '">' +
            (item.solutionTitle || "解决方案") +
            '</h3><div class="challenge-desc">' +
            (item.solutionDesc || "") +
            "</div>";

        challengeBox.appendChild(colLeft);
        challengeBox.appendChild(iconWrap);
        challengeBox.appendChild(colRight);
        fragment.appendChild(challengeBox);
    });

    (data.details || []).forEach(function (item) {
        if (item.title) {
            const detailTitle = document.createElement("h2");

            detailTitle.className = "case-section-title spacing-top";
            detailTitle.textContent = item.title;
            fragment.appendChild(detailTitle);
        }

        if (item.content) {
            const detailDesc = document.createElement("p");

            detailDesc.className = "case-paragraph";
            detailDesc.textContent = item.content;
            fragment.appendChild(detailDesc);
        }

        if (item.imageId) {
            const detailImg = document.createElement("img");
            const realImgUrl = resolveDetailImageUrl(item.imageId, urlMap) || "/assets/images/1.jpg";

            detailImg.className = "case-detail-image";
            detailImg.src = realImgUrl;
            detailImg.alt = item.title || "详情图片";
            fragment.appendChild(detailImg);
        }
    });

    wrapper.appendChild(fragment);
}

function resolveDetailImageUrl(source, urlMap) {
    return urlMap[source] || source || "";
}

function normalizeDetailImageUrlMap(response) {
    const payload = response && (response.data || response.result || response);
    const map = {};

    if (Array.isArray(payload)) {
        payload.forEach(function (item) {
            if (typeof item === "string") {
                return;
            }

            if (!item || typeof item !== "object") {
                return;
            }

            const fileId = item.fileToken || item.fileId || item.id;
            const url = item.tmpDownloadUrl || item.url || item.fileUrl || item.tmpUrl;

            if (fileId && url) {
                map[fileId] = url;
            }
        });

        return map;
    }

    if (payload && typeof payload === "object") {
        Object.keys(payload).forEach(function (key) {
            const value = payload[key];
            const url =
                typeof value === "string"
                    ? value
                    : value && (value.tmpDownloadUrl || value.url || value.fileUrl || value.tmpUrl);

            if (url) {
                map[key] = url;
            }
        });
    }

    return map;
}

function needsImageResolution(url) {
    const source = String(url || "").trim();

    if (!source) {
        return false;
    }

    return !/^(https?:)?\/\//.test(source) && !/^(data:|blob:|\/|\.)/.test(source);
}

function requestApi(url, options) {
    const requestOptions = Object.assign(
        {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        },
        options || {}
    );

    if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
        requestOptions.headers = Object.assign(
            {
                "Content-Type": "application/json",
            },
            requestOptions.headers || {}
        );

        if (typeof requestOptions.body !== "string") {
            requestOptions.body = JSON.stringify(requestOptions.body);
        }
    }

    return fetch(url, requestOptions).then(function (response) {
        if (!response.ok) {
            throw new Error("Request failed with status " + response.status);
        }

        const contentType = response.headers.get("content-type") || "";

        if (contentType.indexOf("application/json") !== -1) {
            return response.json();
        }

        return response.text();
    });
}

function debounce(callback, wait) {
    let timerId = null;

    return function () {
        const context = this;
        const args = arguments;

        window.clearTimeout(timerId);
        timerId = window.setTimeout(function () {
            callback.apply(context, args);
        }, wait);
    };
}
