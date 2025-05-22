const TARGET_URL = "https://pump.fun/create";

function createDeployButton(postElement) {
    const button = document.createElement("button");
    button.innerText = "LFG";
    button.classList.add("deploy-button");

    button.addEventListener("click", async function () {
        const article = this.closest("article");
        const textElement = article.querySelector("div[data-testid='tweetText']");


        let imgElement = article.querySelector("div[data-testid='tweetPhoto'] img");
        if (!imgElement) {
            imgElement = article.querySelector("div[data-testid='card.wrapper'] img");
        }

        const videoElement = article.querySelector("div[data-testid='videoComponent'] video");
        const linkElement = article.querySelector("a[href*='/status/']");

        if (linkElement) {
            let image = imgElement ? imgElement.src : null;

            if (!image && videoElement) {
                image = videoElement.poster;
            }

            const postData = {
                text: textElement?.innerText,
                url: `https://x.com${linkElement.getAttribute("href")}`,
                image: image
            };

            let name = "";
            let description = "";
            let ticker = "";

            if (postData.text) {
                const text = removeNonLettersButKeepSpaces(postData.text);
                name = getFirstSentence(text);
                ticker = extractTicker(name);
                description = postData.text;
            }

            const twitterUrl = postData.url;
            const imageUrl = postData.image;

            const postDataToSave = { name, description, ticker, twitterUrl, imageUrl };

            chrome.storage.local.set({ deployPostData: postDataToSave }, () => {
                console.log("Post data is saved", postDataToSave);
                window.open(`${TARGET_URL}?deploy=true`, '_blank');
            });
        }
    });

    postElement.appendChild(button);
}

function extractTicker(text) {
    const words = text.split(/\s+/).filter(word => word.length > 0);

    if (words.length === 1) {
        return words[0].toUpperCase();
    }

    const abbreviation = words.slice(0, 6).map(w => w[0]?.toUpperCase()).join("");

    return abbreviation || "";
}

function trimQuotes(str) {
    return str.replace(/^[\u201C\u201D\u201E"\s]+|[\u201C\u201D\u201E"\s]+$/g, '');
}

function removeNonLettersButKeepSpaces(text) {
    return text.replace(/[^\p{L}\s]+/gu, '');
}

function getFirstSentence(text) {
    if (!text) {
        return "";
    }

    const dotIndex = text.search(/[.?!]/);
    const newlineIndex = text.indexOf("\n");

    let endIndex;

    if (dotIndex === -1 && newlineIndex === -1) {
        endIndex = 64;
    } else if (dotIndex === -1) {
        endIndex = newlineIndex;
    } else if (newlineIndex === -1) {
        endIndex = dotIndex;
    } else {
        endIndex = Math.min(dotIndex, newlineIndex);
    }

    return text.substring(0, endIndex > 32 ? 32 : endIndex).trim();
}

function processPosts() {
    document.querySelectorAll("article").forEach(article => {
        if (!article.querySelector("button.deploy-button")) {
            createDeployButton(article);
        }
    });
}

function autofillForm() {
    console.log("XLFG autofillForm");
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("deploy")) {
        chrome.storage.local.get("deployPostData", result => {
            if (result.deployPostData) {
                console.log("Read post data:", result.deployPostData);

                const xpath = "//div[starts-with(normalize-space(text()), 'show more options')]";
                let div = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                if (!div) {
                    console.log("XLFG autofillForm finding new UI social links button");
                    const xpath = "//button[.//p[starts-with(normalize-space(text()), 'add social links')]]";
                    div = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    console.log("XLFG autofillForm new UI social links button", div);
                }

                console.log("XLFG autofillForm social links button:", div);
                if (div) {
                    console.log("XLFG autofillForm clicking social links button");
                    div.click();
                }

                const observer = new MutationObserver((mutations, obs) => {
                    const twitter = document.getElementById("twitter");
                    if (twitter) {
                        setReactInputValue(twitter, result.deployPostData.twitterUrl);
                        obs.disconnect();
                    }
                });

                observer.observe(document.body, { childList: true, subtree: true });

                const nameInput = document.getElementById("name");
                const tickerInput = document.getElementById("ticker");

                console.log("XLFG autofillForm name input:", nameInput);
                console.log("XLFG autofillForm ticker input:", tickerInput);

                setReactInputValue(nameInput, result.deployPostData.name);
                setReactInputValue(tickerInput, result.deployPostData.ticker);

                const description = result.deployPostData.description;

                chrome.storage.sync.get(["fillDescription"], (result) => {
                    const isFillDescription = result.fillDescription ?? false;
                    if (isFillDescription) {
                        const descriptionInput = document.getElementById("text");
                        setReactTextareaValue(descriptionInput, description);
                    }
                });

                if (result.deployPostData.imageUrl) {
                    const fileInput = document.querySelector("input[type='file']");
                    setReactFileInput(fileInput, result.deployPostData.imageUrl);
                }
            }
        });
    }
}

function setReactInputValue(element, value) {
    if (!element) return;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
    ).set;

    nativeInputValueSetter.call(element, value);
    dispatchEvents(element);
}

function setReactTextareaValue(element, value) {
    if (!element) return;

    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
    ).set;

    nativeTextareaValueSetter.call(element, value);
    dispatchEvents(element);
}

function dispatchEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function setReactFileInput(input, url, name = 'file') {
    if (!input) return;

    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const file = new File([blob], name, { type: blob.type });

    const dt = new DataTransfer();
    dt.items.add(file);

    try { input.files = dt.files; }
    catch { Object.defineProperty(input, 'files', { value: dt.files }); }

    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    if (typeof input.onchange === 'function') {
        const e = new Event('change');
        Object.defineProperty(e, 'target', { value: input });
        input.onchange(e);
    }
}


if (window.location.href.startsWith(TARGET_URL)) {
    console.log("XLFG start finding name input");
    // if (document.getElementById("name")) {
    //     autofillForm();
    // } else {
        const observer = new MutationObserver((mutations, obs) => {
            if (document.getElementById("name")) {
                autofillForm();
                obs.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    // }
}

window.addEventListener("load", processPosts);
document.addEventListener("scroll", processPosts);
setInterval(processPosts, 1000);