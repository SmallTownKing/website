(function () {
    var PAGE_VISIT_API_URL = window.PAGE_VISIT_API_URL || "/api/pageVisit/add";
    var VISITOR_ID_STORAGE_KEY = "website_visitor_id";
    var IPV4_CACHE_STORAGE_KEY = "website_public_ipv4";
    var COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;
    var IPV4_CACHE_MAX_AGE_MS =
        typeof window.PAGE_VISIT_IPV4_CACHE_MAX_AGE_MS === "number"
            ? window.PAGE_VISIT_IPV4_CACHE_MAX_AGE_MS
            : 24 * 60 * 60 * 1000;
    var enteredAt = Date.now();
    var visibleStartedAt = document.visibilityState === "visible" ? enteredAt : 0;
    var browseDuration = 0;
    var hasReported = false;
    var visitorId = getOrCreateVisitorId();
    var ipv4 = "";

    initIpv4();

    document.addEventListener("visibilitychange", handleVisibilityChange, { passive: true });
    window.addEventListener("pagehide", handlePageHide, { passive: true });
    window.addEventListener("pageshow", handlePageShow, { passive: true });
    window.addEventListener("beforeunload", reportVisit);

    function handleVisibilityChange() {
        if (document.visibilityState === "hidden") {
            accumulateBrowseDuration();
            return;
        }

        if (!visibleStartedAt) {
            visibleStartedAt = Date.now();
        }
    }

    function handlePageHide(event) {
        reportVisit();
    }

    function handlePageShow(event) {
        if (!event || !event.persisted || hasReported) {
            return;
        }

        if (document.visibilityState === "visible" && !visibleStartedAt) {
            visibleStartedAt = Date.now();
        }
    }

    function accumulateBrowseDuration() {
        if (!visibleStartedAt) {
            return;
        }

        browseDuration += Math.max(0, Date.now() - visibleStartedAt);
        visibleStartedAt = 0;
    }

    function reportVisit() {
        if (hasReported) {
            return;
        }

        hasReported = true;
        accumulateBrowseDuration();

        var payload = buildPayload();
        requestApi(PAGE_VISIT_API_URL, {
            method: "POST",
            body: payload,
            keepalive: true,
        }).catch(function () {
            return undefined;
        });
    }

    function buildPayload() {
        var now = Date.now();
        var currentBrowseDuration = browseDuration;

        if (visibleStartedAt) {
            currentBrowseDuration += Math.max(0, now - visibleStartedAt);
        }
        return {
            uniqueId: visitorId,
            ipv4: ipv4,
            pageUrl: { text: '', link: window.location.href },
            eventType: 'page_view',
            deviceType: detectDeviceType(),
            stayDurationSeconds: Math.ceil(Math.max(0, now - enteredAt) / 1000),
            browseDurationSeconds: Math.ceil(Math.max(0, currentBrowseDuration) / 1000),
            source: detectSource(),
        };
    }

    function detectDeviceType() {
        var ua = (navigator.userAgent || "").toLowerCase();


        if (/iphone|ipad|ipod|ios/.test(ua)) {
            return "IOS";
        }

        if (/android/.test(ua)) {
            return "ANDROID";
        }

        return "PC";
    }

    function detectSource() {
        var ua = navigator.userAgent || "";
        var lowerUa = ua.toLowerCase();
        if (/micromessenger/.test(lowerUa)) {
            return /wxwork/.test(lowerUa) ? "企业微信内置浏览器" : "微信内置浏览器";
        }

        if (/qq\//.test(lowerUa) || /qqbrowser/.test(lowerUa)) {
            return /qqbrowser/.test(lowerUa) ? "QQ浏览器" : "QQ内置浏览器";
        }

        if (/weibo/.test(lowerUa)) {
            return "微博内置浏览器";
        }
        if (/douyin/.test(lowerUa) || /bytelocale/.test(lowerUa)) {
            return "抖音内置浏览器";
        }
        if (/alipayclient/.test(lowerUa)) {
            return "支付宝内置浏览器";
        }
        if (/dingtalk/.test(lowerUa)) {
            return "钉钉内置浏览器";
        }

        if (/edg\//.test(lowerUa)) {
            return "Edge浏览器";
        }

        if (/edgios\//.test(lowerUa) || /edga\//.test(lowerUa)) {
            return "Edge浏览器";
        }

        if (/opr\//.test(lowerUa) || /opera/.test(lowerUa)) {
            return "Opera浏览器";
        }

        if (/firefox\//.test(lowerUa)) {
            return "火狐浏览器";
        }

        if (/fxios\//.test(lowerUa)) {
            return "火狐浏览器";
        }

        if (/samsungbrowser\//.test(lowerUa)) {
            return "三星浏览器";
        }

        if (/ucbrowser\//.test(lowerUa) || /\buc\b/.test(lowerUa)) {
            return "UC浏览器";
        }

        if (/metasr/.test(lowerUa) || /360se/.test(lowerUa) || /360ee/.test(lowerUa)) {
            return "360浏览器";
        }

        if (/se 2.x/.test(lowerUa) || /sogoumobilebrowser/.test(lowerUa)) {
            return "搜狗浏览器";
        }

        if (/qqbrowser\//.test(lowerUa)) {
            return "QQ浏览器";
        }

        if (/chrome\//.test(lowerUa) && !/edg\//.test(lowerUa) && !/opr\//.test(lowerUa)) {
            return "谷歌浏览器";
        }

        if (/crios\//.test(lowerUa)) {
            return "谷歌浏览器";
        }

        if (/safari\//.test(lowerUa) && !/chrome\//.test(lowerUa)) {
            return "Safari浏览器";
        }

        if (/msie|trident\//.test(lowerUa)) {
            return "IE浏览器";
        }

        return "未知浏览器";
    }

    function getOrCreateVisitorId() {
        var storedVisitorId = readVisitorId();

        if (storedVisitorId) {
            return storedVisitorId;
        }

        var nextVisitorId = createVisitorId();
        persistVisitorId(nextVisitorId);
        return nextVisitorId;
    }

    function readVisitorId() {
        try {
            var fromStorage = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);

            if (fromStorage) {
                return fromStorage;
            }
        } catch (error) {
            // Ignore storage errors and fall back to cookies.
        }

        var matched = document.cookie.match(new RegExp("(?:^|; )" + VISITOR_ID_STORAGE_KEY + "=([^;]*)"));
        return matched ? decodeURIComponent(matched[1]) : "";
    }

    function initIpv4() {
        var cachedIpv4Record = readCachedIpv4Record();

        if (cachedIpv4Record && cachedIpv4Record.ip) {
            ipv4 = cachedIpv4Record.ip;
        }

        if (!cachedIpv4Record || isIpv4CacheExpired(cachedIpv4Record)) {
            refreshIpv4();
        }
    }

    function readCachedIpv4Record() {
        try {
            var rawValue = window.localStorage.getItem(IPV4_CACHE_STORAGE_KEY);

            if (!rawValue) {
                return null;
            }

            var parsedValue = JSON.parse(rawValue);

            if (!parsedValue || typeof parsedValue !== "object") {
                return null;
            }

            return {
                ip: typeof parsedValue.ip === "string" ? parsedValue.ip : "",
                updatedAt: Number(parsedValue.updatedAt) || 0,
            };
        } catch (error) {
            return null;
        }
    }

    function isIpv4CacheExpired(record) {
        if (!record || !record.updatedAt) {
            return true;
        }

        return Date.now() - record.updatedAt >= IPV4_CACHE_MAX_AGE_MS;
    }

    function refreshIpv4() {
        fetch("https://api.ipify.org?format=json", {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Failed to fetch IPv4 with status " + response.status);
                }

                return response.json();
            })
            .then(function (data) {
                var nextIpv4 = data && typeof data.ip === "string" ? data.ip.trim() : "";

                if (!nextIpv4) {
                    return;
                }

                ipv4 = nextIpv4;

                try {
                    window.localStorage.setItem(
                        IPV4_CACHE_STORAGE_KEY,
                        JSON.stringify({
                            ip: nextIpv4,
                            updatedAt: Date.now(),
                        })
                    );
                } catch (error) {
                    return;
                }
            })
            .catch(function () {
                return undefined;
            });
    }

    function persistVisitorId(visitorIdValue) {
        try {
            window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorIdValue);
        } catch (error) {
            // Ignore storage errors and keep cookie fallback.
        }

        document.cookie =
            VISITOR_ID_STORAGE_KEY +
            "=" +
            encodeURIComponent(visitorIdValue) +
            "; path=/; max-age=" +
            COOKIE_MAX_AGE +
            "; SameSite=Lax";
    }

    function createVisitorId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }

        return "visitor-" + Date.now() + "-" + Math.random().toString(16).slice(2, 10);
    }

    function requestApi(url, options) {
        var requestOptions = Object.assign(
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

            var contentType = response.headers.get("content-type") || "";

            if (contentType.indexOf("application/json") !== -1) {
                return response.json();
            }

            return response.text();
        });
    }
})();
