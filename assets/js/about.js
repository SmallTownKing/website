document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initLeadForm();
    initSolutionModal();
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

    if (!form || !submitBtn || !nameInput || !phoneInput) {
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const nameValue = nameInput.value.trim();
        const phoneValue = phoneInput.value.trim();
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
                clientName: nameValue,
                phoneNumber: phoneValue,
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
