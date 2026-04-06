document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initLeadForm();
    initSolutionModal();
    void initProductsPage();
});

// ✅ 优化 1：修改了默认配置，区分开 Tab 接口和列表接口
const DEFAULT_PRODUCTS_API_CONFIG = {
    tabsUrl: "/api/projectCase/list/industry", // 获取分类 Tab 的接口
    listUrl: "/api/projectCase/list",          // 获取案例列表的接口
    tabsMethod: "GET",
    listMethod: "GET",
    tabIdParam: "categoryId",
    tabSlugParam: "categoryCode",
    tabNameParam: "categoryName",
    pageSizeParam: "pageSize",
};

const PRODUCT_TAB_SKELETON_COUNT = 4;
const PRODUCT_CARD_SKELETON_COUNT = 8;
const PRODUCT_IMAGE_FALLBACK = "/assets/images/1.jpg";

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
                    clientName: nameValue,
                    phoneNumber: phoneValue,
                },
            })
                .then(function () {
                    form.reset();
                    alert("提交成功，我们会尽快与您联系。");
                })
                .catch(function (error) {
                    console.error("Lead form submit failed:", error);
                    alert("提交失败，请稍后再试。");
                })
                .finally(function () {
                    if (submitButton) {
                        submitButton.textContent = "立即预约";
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
            alert("请输入您的姓名。");
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

async function initProductsPage() {
    const section = document.querySelector("[data-products-page]");
    const tabsScroller = section ? section.querySelector("[data-products-tabs-scroller]") : null;
    const tabsContainer = section ? section.querySelector("[data-products-tabs]") : null;
    const listContainer = section ? section.querySelector("[data-products-list]") : null;
    const emptyState = section ? section.querySelector("[data-products-empty]") : null;
    const status = section ? section.querySelector("[data-products-status]") : null;

    if (!section || !tabsContainer || !listContainer) {
        return;
    }

    const apiConfig = getProductsApiConfig(section);
    let tabs = [createDefaultAllTab()];
    let activeTab = tabs[0];
    let allProducts = [];

    const renderActiveProducts = function (tab) {
        const filteredProducts = filterProductsByTab(allProducts, tab);

        renderProductList(listContainer, filteredProducts);
        toggleEmptyState(emptyState, !filteredProducts.length);
        setStatus(status, filteredProducts.length ? "内容已更新" : "暂无相关内容");
    };

    const handleTabSelect = function (tab) {
        if (isSameTab(tab, activeTab)) {
            scrollActiveTabIntoView(tabsScroller || tabsContainer);
            return;
        }

        activeTab = tab;
        setActiveTabState(tabsContainer, activeTab);
        scrollActiveTabIntoView(tabsScroller || tabsContainer);
        renderActiveProducts(activeTab);
    };

    renderTabSkeletons(tabsContainer, PRODUCT_TAB_SKELETON_COUNT);
    renderProductSkeletons(listContainer, PRODUCT_CARD_SKELETON_COUNT);
    setTabsLoading(tabsContainer, true);
    setListLoading(listContainer, true);
    toggleEmptyState(emptyState, false);
    setStatus(status, "正在加载内容...");

    try {
        const requestedTabs = await fetchProductsTabs(apiConfig);

        if (requestedTabs.length) {
            tabs = ensureAllTab(requestedTabs);
        }
    } catch (error) {
        console.warn("Failed to load product tabs:", error);
    }

    try {
        allProducts = await fetchProductsContent(apiConfig, createDefaultAllTab());
        allProducts = await hydrateProductImages(allProducts);
    } catch (error) {
        console.warn("Failed to load product content:", error);
        allProducts = [];
    }

    if (tabs.length <= 1 && allProducts.length) {
        tabs = ensureAllTab(buildTabsFromProducts(allProducts));
    }

    activeTab = resolveActiveTab(tabs, activeTab);
    setTabsLoading(tabsContainer, false);
    setListLoading(listContainer, false);
    renderTabs(tabsContainer, tabs, activeTab, handleTabSelect);
    setActiveTabState(tabsContainer, activeTab);
    scrollActiveTabIntoView(tabsScroller || tabsContainer);
    renderActiveProducts(activeTab);
}

function getProductsApiConfig(section) {
    const pageConfig = cleanObject({
        tabsUrl: section.getAttribute("data-tabs-url"),
        listUrl: section.getAttribute("data-list-url"),
        tabIdParam: section.getAttribute("data-tab-id-param"),
        tabSlugParam: section.getAttribute("data-tab-slug-param"),
        tabNameParam: section.getAttribute("data-tab-name-param"),
    });

    return Object.assign({}, DEFAULT_PRODUCTS_API_CONFIG, window.PRODUCTS_API_CONFIG || {}, pageConfig);
}

function fetchProductsTabs(apiConfig) {
    const requestOptions = buildApiRequestOptions(apiConfig.tabsMethod, apiConfig.tabsParams);

    return requestApi(apiConfig.tabsUrl, requestOptions).then(function (response) {
        return ensureAllTab(
            extractArray(response)
                .map(function (item, index) {
                    return normalizeTabItem(item, index);
                })
                .filter(Boolean)
        );
    });
}

function fetchProductsContent(apiConfig, activeTab) {
    const params = Object.assign({}, apiConfig.listParams || {});
    const requestOptions = buildApiRequestOptions(apiConfig.listMethod, params);

    if (apiConfig.pageSizeParam && apiConfig.pageSize) {
        requestOptions.params[apiConfig.pageSizeParam] = apiConfig.pageSize;
    }

    if (activeTab && !activeTab.isAll) {
        if (apiConfig.tabIdParam && activeTab.id) {
            requestOptions.params[apiConfig.tabIdParam] = activeTab.id;
        }

        if (apiConfig.tabSlugParam && activeTab.slug) {
            requestOptions.params[apiConfig.tabSlugParam] = activeTab.slug;
        }

        if (apiConfig.tabNameParam && activeTab.name) {
            requestOptions.params[apiConfig.tabNameParam] = activeTab.name;
        }
    }

    return requestApi(apiConfig.listUrl, requestOptions).then(function (response) {
        return extractArray(response)
            .map(function (item, index) {
                return normalizeProductItem(item, index);
            })
            .filter(Boolean);
    });
}

function buildApiRequestOptions(method, params) {
    return {
        method: (method || "GET").toUpperCase(),
        params: Object.assign({}, params || {}),
    };
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
    const params = Object.assign({}, requestOptions.params || {});
    const method = (requestOptions.method || "GET").toUpperCase();

    delete requestOptions.params;

    let requestUrl = url;

    if (method === "GET") {
        requestUrl = buildUrlWithParams(url, params);
    } else if (!requestOptions.body && Object.keys(params).length) {
        requestOptions.headers = Object.assign(
            {
                "Content-Type": "application/json",
            },
            requestOptions.headers || {}
        );
        requestOptions.body = JSON.stringify(params);
    } else if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
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

    return fetch(requestUrl, requestOptions).then(function (response) {
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

function buildUrlWithParams(url, params) {
    const query = new URLSearchParams();

    Object.keys(params || {}).forEach(function (key) {
        const value = params[key];

        if (value === null || value === undefined || value === "") {
            return;
        }

        query.set(key, value);
    });

    if (!query.toString()) {
        return url;
    }

    return url + (url.indexOf("?") === -1 ? "?" : "&") + query.toString();
}

function setTabsLoading(container, isLoading) {
    container.classList.toggle("products-filter--loading", isLoading);
    container.setAttribute("aria-busy", String(isLoading));
}

function renderTabSkeletons(container, count) {
    const widths = [92, 84, 116, 104];

    container.innerHTML = "";

    for (let index = 0; index < count; index += 1) {
        const skeleton = document.createElement("span");

        skeleton.className = "products-filter__skeleton";
        skeleton.setAttribute("aria-hidden", "true");
        skeleton.style.setProperty("--products-tab-skeleton-width", widths[index % widths.length] + "px");
        container.appendChild(skeleton);
    }
}

function renderTabs(container, tabs, activeTab, onTabSelect) {
    const activeId = activeTab ? activeTab.id : "";

    container.innerHTML = "";

    tabs.forEach(function (tab, index) {
        const button = document.createElement("button");
        const isActive = tab.id === activeId;

        button.type = "button";
        button.className = "products-filter__tab" + (isActive ? " is-active" : "");
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(isActive));
        button.setAttribute("tabindex", isActive ? "0" : "-1");
        button.dataset.tabId = tab.id;
        button.dataset.tabSlug = tab.slug;
        button.dataset.tabName = tab.name;
        button.textContent = tab.name;

        button.addEventListener("click", function () {
            onTabSelect(tab);
        });

        button.addEventListener("keydown", function (event) {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
            }

            event.preventDefault();

            const nextIndex = event.key === "ArrowRight" ? index + 1 : index - 1;
            const resolvedIndex = (nextIndex + tabs.length) % tabs.length;
            const nextTab = tabs[resolvedIndex];
            const nextButton = container.children[resolvedIndex];

            if (nextButton) {
                nextButton.focus();
            }

            onTabSelect(nextTab);
        });

        container.appendChild(button);
    });
}

function setActiveTabState(container, activeTab) {
    const activeId = activeTab ? normalizeComparable(activeTab.id) : "";

    Array.from(container.querySelectorAll(".products-filter__tab")).forEach(function (button) {
        const isActive = normalizeComparable(button.dataset.tabId) === activeId;

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        button.setAttribute("tabindex", isActive ? "0" : "-1");
    });
}

function renderProductSkeletons(container, count) {
    container.innerHTML = "";
    container.classList.add("products-grid--skeleton");

    for (let index = 0; index < count; index += 1) {
        container.appendChild(createProductCardSkeleton());
    }
}

function createProductCardSkeleton() {
    const article = document.createElement("article");
    const panel = document.createElement("div");
    const image = document.createElement("div");
    const body = document.createElement("div");
    const tag = document.createElement("div");
    const title = document.createElement("div");
    const line = document.createElement("div");
    const shortLine = document.createElement("div");

    article.className = "products-card products-card--skeleton";
    article.setAttribute("aria-hidden", "true");

    panel.className = "products-card__panel hover-card";
    image.className = "products-card__image products-skeleton-block";
    body.className = "products-card__body";
    tag.className = "products-card__tag products-skeleton-block products-skeleton-shimmer";
    title.className = "products-skeleton-line products-skeleton-line--title products-skeleton-shimmer";
    line.className = "products-skeleton-line products-skeleton-shimmer";
    shortLine.className = "products-skeleton-line products-skeleton-line--short products-skeleton-shimmer";

    body.appendChild(tag);
    body.appendChild(title);
    body.appendChild(line);
    body.appendChild(shortLine);
    panel.appendChild(image);
    panel.appendChild(body);
    article.appendChild(panel);

    return article;
}

function renderProductList(container, products) {
    container.innerHTML = "";
    container.classList.remove("products-grid--skeleton");

    if (!products.length) {
        return;
    }

    const fragment = document.createDocumentFragment();

    products.forEach(function (product) {
        fragment.appendChild(createProductCard(product));
    });

    container.appendChild(fragment);
}

function createProductCard(product) {
    const article = document.createElement("article");
    const link = document.createElement("a");
    const panel = document.createElement("div");
    const image = document.createElement("img");
    const body = document.createElement("div");
    const tag = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");

    article.className = "products-card";
    article.dataset.productItem = "true";
    article.dataset.productId = product.id || "";
    article.dataset.productGroup = (product.groupValues || []).join(",");
    article.dataset.productTag = product.tag || "";
    article.dataset.productTitle = product.title || "";
    article.dataset.productDescription = product.description || "";
    article.dataset.productImage = product.imageRenderUrl || product.imageUrl || "";
    article.dataset.productUrl = product.detailUrl || "";

    link.className = "products-card__link";
    link.href = product.detailUrl || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    panel.className = "products-card__panel hover-card";
    image.className = "products-card__image";
    image.src = product.imageRenderUrl || product.imageUrl || PRODUCT_IMAGE_FALLBACK;
    image.alt = (product.title || "案例") + "封面";

    body.className = "products-card__body";
    tag.className = "products-card__tag";
    title.className = "products-card__title";
    description.className = "products-card__desc";

    tag.textContent = product.tag || "成功案例";
    title.textContent = product.title || "未命名案例";
    description.textContent = product.description || "暂无案例简介";

    body.appendChild(tag);
    body.appendChild(title);
    body.appendChild(description);
    panel.appendChild(image);
    panel.appendChild(body);
    link.appendChild(panel);
    article.appendChild(link);

    return article;
}

async function hydrateProductImages(products) {
    const nextProducts = Array.isArray(products) ? products.slice() : [];
    const fileIds = Array.from(
        new Set(
            nextProducts
                .map(function (product) {
                    return product.imageUrl;
                })
                .filter(function (imageUrl) {
                    return needsImageResolution(imageUrl);
                })
        )
    );

    if (!fileIds.length) {
        return nextProducts.map(function (product) {
            return Object.assign({}, product, {
                imageRenderUrl: product.imageUrl || PRODUCT_IMAGE_FALLBACK,
            });
        });
    }

    let urlMap = {};

    try {
        const response = await requestApi("/api/file/getFileTmpUrl?fileIds=" + fileIds.join(","));
        urlMap = normalizeImageUrlMap(response);
    } catch (error) {
        console.warn("Failed to resolve product images:", error);
    }

    return nextProducts.map(function (product) {
        return Object.assign({}, product, {
            imageRenderUrl: urlMap[product.imageUrl] || product.imageUrl || PRODUCT_IMAGE_FALLBACK,
        });
    });
}

function normalizeImageUrlMap(response) {
    const payload = pickFirstValue(response && response.data, response && response.result, response);
    const map = {};

    if (Array.isArray(payload)) {
        payload.forEach(function (item) {
            if (!item || typeof item !== "object") {
                return;
            }

            const fileId = pickFirstValue(item.fileToken, item.fileId, item.id);
            const imageUrl = pickFirstValue(item.tmpDownloadUrl, item.url, item.fileUrl, item.tmpUrl);

            if (fileId && imageUrl) {
                map[fileId] = imageUrl;
            }
        });

        return map;
    }

    if (payload && typeof payload === "object") {
        Object.keys(payload).forEach(function (key) {
            const value = payload[key];
            const imageUrl = typeof value === "string"
                ? value
                : pickFirstValue(value && value.tmpDownloadUrl, value && value.url, value && value.fileUrl, value && value.tmpUrl);

            if (imageUrl) {
                map[key] = imageUrl;
            }
        });
    }

    return map;
}

function normalizeTabItem(item, index) {
    if (!item) {
        return null;
    }

    if (typeof item === "string") {
        item = {
            name: item,
        };
    }

    const name = pickFirstValue(item.name, item.tabName, item.categoryName, item.label, item.title, item.text);
    const id = String(
        pickFirstValue(item.id, item.tabId, item.categoryId, item.value, item.code, item.key, item.slug, name, "tab-" + index)
    ).trim();
    const slug = String(pickFirstValue(item.slug, item.code, item.key, item.value, id)).trim();
    const isAll = Boolean(item.isAll || normalizeComparable(id) === "all" || normalizeComparable(slug) === "all" || name === "全部");

    if (!name) {
        return null;
    }

    return {
        id: isAll ? "all" : id,
        slug: isAll ? "all" : slug,
        name: name,
        isAll: isAll,
        active: Boolean(item.active || item.selected || item.default || item.checked),
    };
}

function normalizeProductItem(item, index) {
    if (!item || typeof item !== "object") {
        return null;
    }

    const id = String(pickFirstValue(item.recordId, item.productId, item.caseId, item.id, item.idStr, index + 1)).trim();
    const title = pickFirstValue(item.title, item.name, item.productName, item.caseName, item.projectName);
    const description = pickFirstValue(
        item.description,
        item.desc,
        item.summary,
        item.introduction,
        item.customerBackground,
        item.content
    );

    if (!title) {
        return null;
    }

    const filterValues = uniqueValues(
        []
            .concat(splitGroupValues(item.group))
            .concat(splitGroupValues(item.groups))
            .concat(splitGroupValues(item.tab))
            .concat(splitGroupValues(item.tabKey))
            .concat(splitGroupValues(item.tabSlug))
            .concat(splitGroupValues(item.categoryId))
            .concat(splitGroupValues(item.categoryCode))
            .concat(splitGroupValues(item.categoryName))
            .concat(splitGroupValues(item.type))
            .concat(splitGroupValues(item.industry))
            .concat(splitGroupValues(item.tag))
    );

    const imageUrl = pickFirstValue(
        resolveMediaValue(item.imageUrl),
        resolveMediaValue(item.cover),
        resolveMediaValue(item.image),
        resolveMediaValue(item.banner),
        resolveMediaValue(item.background),
        resolveMediaValue(item.titleBackgroundImage),
        resolveMediaValue(item.coverImage),
        resolveMediaValue(item.contentImage),
        resolveMediaValue(item.imageList)
    );

    return {
        id: id,
        title: title,
        tag: pickFirstValue(item.tag, item.category, item.categoryName, item.type, item.industry, "成功案例"),
        description: description || "暂无案例简介",
        imageUrl: imageUrl,
        detailUrl:
            pickFirstValue(item.detailUrl, item.url, item.href, item.link) ||
            "/products/detail/?id=" + encodeURIComponent(id),
        groupValues: filterValues,
    };
}

function filterProductsByTab(products, activeTab) {
    return (products || []).filter(function (product) {
        return matchesTab(product, activeTab);
    });
}

function matchesTab(product, activeTab) {
    if (!activeTab || activeTab.isAll) {
        return true;
    }

    const targets = uniqueValues([activeTab.id, activeTab.slug, activeTab.name])
        .map(normalizeComparable)
        .filter(Boolean);
    const sources = uniqueValues(
        []
            .concat(product.groupValues || [])
            .concat(product.tag || [])
    )
        .map(normalizeComparable)
        .filter(Boolean);

    if (!targets.length) {
        return true;
    }

    return targets.some(function (target) {
        return sources.indexOf(target) !== -1;
    });
}

function toggleEmptyState(emptyState, isEmpty) {
    if (!emptyState) {
        return;
    }

    emptyState.hidden = !isEmpty;
}

function setListLoading(container, isLoading) {
    container.classList.toggle("is-loading", isLoading);
    container.setAttribute("aria-busy", String(isLoading));
}

function setStatus(statusElement, message) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message || "";
}

function scrollActiveTabIntoView(container) {
    if (!container) {
        return;
    }

    if (window.innerWidth > 768) {
        return;
    }

    const tabsContainer = container.matches(".products-filter") ? container : container.querySelector(".products-filter");
    const activeButton = tabsContainer ? tabsContainer.querySelector(".products-filter__tab.is-active") : null;
    const scroller = container.matches("[data-products-tabs-scroller]") ? container : container.closest("[data-products-tabs-scroller]") || container;

    if (!activeButton || typeof activeButton.scrollIntoView !== "function") {
        return;
    }

    if (scroller.scrollWidth <= scroller.clientWidth + 1) {
        return;
    }

    window.requestAnimationFrame(function () {
        const scrollerRect = scroller.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        const gap = 16;

        if (buttonRect.left < scrollerRect.left + gap) {
            scroller.scrollLeft -= scrollerRect.left + gap - buttonRect.left;
            return;
        }

        if (buttonRect.right > scrollerRect.right - gap) {
            scroller.scrollLeft += buttonRect.right - (scrollerRect.right - gap);
        }
    });
}

function resolveActiveTab(tabs, currentActiveTab) {
    if (!tabs.length) {
        return createDefaultAllTab();
    }

    if (currentActiveTab) {
        const matchedTab = tabs.find(function (tab) {
            return isSameTab(tab, currentActiveTab);
        });

        if (matchedTab) {
            return matchedTab;
        }
    }

    return getInitialActiveTab(tabs);
}

function getInitialActiveTab(tabs) {
    return tabs.find(function (tab) {
        return tab.active;
    }) || tabs[0] || createDefaultAllTab();
}

function ensureAllTab(tabs) {
    const dedupedTabs = [];
    const usedKeys = {};

    tabs.forEach(function (tab) {
        const normalizedTab = normalizeTabItem(tab, dedupedTabs.length);

        if (!normalizedTab) {
            return;
        }

        const identity = normalizeComparable(normalizedTab.id || normalizedTab.slug || normalizedTab.name);

        if (!identity || usedKeys[identity]) {
            return;
        }

        usedKeys[identity] = true;
        dedupedTabs.push(normalizedTab);
    });

    const hasAllTab = dedupedTabs.some(function (tab) {
        return tab.isAll;
    });

    if (!hasAllTab) {
        dedupedTabs.unshift(createDefaultAllTab());
    } else {
        dedupedTabs.sort(function (left, right) {
            if (left.isAll) {
                return -1;
            }

            if (right.isAll) {
                return 1;
            }

            return 0;
        });
    }

    return dedupedTabs;
}

function buildTabsFromProducts(products) {
    const derivedTabs = [];

    (products || []).forEach(function (product, index) {
        const name = pickFirstValue(product.tag, product.groupValues && product.groupValues[0]);

        if (!name || normalizeComparable(name) === "all") {
            return;
        }

        derivedTabs.push(
            normalizeTabItem(
                {
                    id: name,
                    slug: name,
                    name: name,
                },
                index
            )
        );
    });

    return derivedTabs.filter(Boolean);
}

function createDefaultAllTab() {
    return {
        id: "all",
        slug: "all",
        name: "全部",
        isAll: true,
        active: true,
    };
}

function extractArray(response) {
    const candidates = [
        response,
        response && response.data,
        response && response.result,
        response && response.list,
        response && response.rows,
        response && response.records,
        response && response.items,
        response && response.tabs,
        response && response.categories,
        response && response.data && response.data.list,
        response && response.data && response.data.rows,
        response && response.data && response.data.records,
        response && response.data && response.data.items,
        response && response.data && response.data.tabs,
        response && response.data && response.data.categories,
        response && response.result && response.result.list,
        response && response.result && response.result.rows,
        response && response.result && response.result.records,
        response && response.result && response.result.items,
    ];

    for (let index = 0; index < candidates.length; index += 1) {
        if (Array.isArray(candidates[index])) {
            return candidates[index];
        }
    }

    return [];
}

function splitGroupValues(value) {
    if (Array.isArray(value)) {
        return value
            .map(function (item) {
                return String(item).trim();
            })
            .filter(Boolean);
    }

    if (value === null || value === undefined || value === "") {
        return [];
    }

    return String(value)
        .split(/[,\|/，]/)
        .map(function (item) {
            return item.trim();
        })
        .filter(Boolean);
}

function resolveMediaValue(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        return value.trim();
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const resolved = resolveMediaValue(value[index]);

            if (resolved) {
                return resolved;
            }
        }

        return "";
    }

    if (typeof value === "object") {
        return pickFirstValue(
            value.fileToken,
            value.token,
            value.tmpDownloadUrl,
            value.tmpUrl,
            value.url,
            value.fileUrl,
            value.src,
            value.path,
            value.thumbnail,
            value.previewUrl,
            value.preview,
            value.imageUrl
        );
    }

    return "";
}

function needsImageResolution(value) {
    const source = String(value || "").trim();

    if (!source) {
        return false;
    }

    return !/^(https?:)?\/\//.test(source) && !/^(data:|blob:|\/|\.)/.test(source);
}

function uniqueValues(values) {
    return Array.from(
        new Set(
            (values || [])
                .map(function (value) {
                    return String(value || "").trim();
                })
                .filter(Boolean)
        )
    );
}

function pickFirstValue() {
    for (let index = 0; index < arguments.length; index += 1) {
        const value = arguments[index];

        if (value === null || value === undefined) {
            continue;
        }

        if (typeof value === "string" && !value.trim()) {
            continue;
        }

        return value;
    }

    return "";
}

function cleanObject(source) {
    const target = {};

    Object.keys(source || {}).forEach(function (key) {
        if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
            target[key] = source[key];
        }
    });

    return target;
}

function normalizeComparable(value) {
    return String(value || "").trim().toLowerCase();
}

function isSameTab(left, right) {
    if (!left || !right) {
        return false;
    }

    return (
        normalizeComparable(left.id) === normalizeComparable(right.id) ||
        normalizeComparable(left.slug) === normalizeComparable(right.slug) ||
        normalizeComparable(left.name) === normalizeComparable(right.name)
    );
}

function getText(element) {
    return element ? (element.textContent || "").trim() : "";
}

function debounce(callback, wait) {
    let timer = null;

    return function () {
        const args = arguments;
        const context = this;

        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
            callback.apply(context, args);
        }, wait);
    };
}
