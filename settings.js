document.addEventListener("DOMContentLoaded", () => {
    const enableFeatureCheckbox = document.getElementById("fillDescription");
    const saveButton = document.getElementById("save");

    chrome.storage.sync.get(["fillDescription"], (result) => {
        enableFeatureCheckbox.checked = result.fillDescription ?? false;
    });

    saveButton.addEventListener("click", () => {
        chrome.storage.sync.set({ fillDescription: enableFeatureCheckbox.checked }, () => {
        });
    });
});
