// ==UserScript==
// @name         YT ratio
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Stores visited video likes / dislikes ratios and creates browsable rankings.
// @author       Flagoul
// @match        https://www.youtube.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const LS_KEY = "us-yt-ratio";

    /**
    * Retrieves values related to current video and stores them in an object, that contains:
    * - id: the video id
    * - title: the video title
    * - view count: how many views the video has
    * - likes: the number of likes on the video
    * - dislikes: the number of dislikes on the video
    * - ratio: the raio of likes / dislikes of the video
    *
    * @return {Object} an object as described above. null if the video contains no likes / dislikes.
    */
    function retrieveValues() {
        let values = document.querySelectorAll(".like-button-renderer > span:nth-of-type(odd) button span");

        // no likes / dislikes
        if (values.length === 0) {
            return null;
        }

        let id = document.location.href.match(".*?v=([^&]*)")[1];
        let title = document.querySelector("#eow-title").title;

        let viewCount = parseInt(document.querySelector(".watch-view-count").textContent.split(/\s+/).slice(0, -1).join(""));

        let likes = parseInt(values[0].textContent.replace(/\s+/g, ""));
        let dislikes = parseInt(values[1].textContent.replace(/\s+/g, ""));

        return {
            "id": id,
            "title": title,
            "viewCount": viewCount,
            "likes": likes,
            "dislikes": dislikes,
            "ratio": likes/dislikes
        };
    }

    /**
    * Displays the ratio of likes / dislikes of the video.
    *
    * @param {Number} ratio - The ratio of likes / dislikes.
    */
    function displayRatio(ratio) {
        GM_addStyle(`
            .ratio-icon:before {
                margin-right: 4px !important;
                opacity: 1 !important;
                margin-bottom: 3px !important;
            }
        `);

        let ratioValue = document.createElement("span");
        ratioValue.classList.add("yt-uix-button-content");
        ratioValue.appendChild(document.createTextNode(ratio.toFixed(2)));

        let button = document.createElement("button");
        button.classList.add("yt-uix-button", "yt-uix-button-opacity", "yt-ui-menu-item", "has-icon", "action-panel-trigger-stats", "ratio-icon");
        button.appendChild(ratioValue);
        button.style.width = "inherit";

        let ratioSpan = document.createElement("span");
        ratioSpan.appendChild(button);
        ratioSpan.setAttribute("title", "Ratio likes / dislikes");

        document.querySelector(".like-button-renderer").appendChild(ratioSpan);
    }

    function displayRatioAndSaveValues() {
        let values = retrieveValues();

        // the video is worth registering (has likes and dislikes)
        if (values !== null) {
            displayRatio(values.ratio);

            let storedValues = JSON.parse(localStorage.getItem(LS_KEY));
            if (storedValues === null) {
                storedValues = {};
            }

            storedValues[values.id] = values;

            // FIXME remove later
            console.log("Videos values stored:");
            for (let key in storedValues) {
                if (storedValues.hasOwnProperty(key)) {
                    console.log(key, storedValues[key]);
                }
            }

            localStorage.setItem(LS_KEY, JSON.stringify(storedValues));
        }
    }

    displayRatioAndSaveValues();

    window.addEventListener("spfdone", function(e) {
        displayRatioAndSaveValues();
    });
})();