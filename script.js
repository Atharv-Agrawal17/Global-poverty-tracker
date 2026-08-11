/* =========================================================
   GLOBAL POVERTY TRACKER
   World Bank Poverty and Inequality Platform
   ========================================================= */

const API_BASE = "https://pip.worldbank.org/pip/v1";

const POVERTY_LINE = 3;

let povertyChart = null;
let peopleChart = null;


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


function showError(message) {
    $("error").textContent = message;
    $("error").classList.remove("hidden");
}


function clearError() {
    $("error").classList.add("hidden");
}


function number(value, decimals = 2) {

    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(Number(value))
    ) {
        return "Unavailable";
    }

    return Number(value).toLocaleString(
        undefined,
        {
            maximumFractionDigits: decimals
        }
    );
}


function population(value) {

    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(Number(value))
    ) {
        return "Unavailable";
    }

    const n = Number(value);

    if (n >= 1000000) {
        return (
            (n / 1000000).toLocaleString(
                undefined,
                {
                    maximumFractionDigits: 2
                }
            ) + " million"
        );
    }

    return n.toLocaleString();
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function getJSON(url) {

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Accept": "application/json"
        },
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(
            `World Bank API error: HTTP ${response.status}`
        );
    }

    const text = await response.text();

    if (!text) {
        throw new Error(
            "The World Bank API returned an empty response."
        );
    }

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            "The World Bank API returned data that was not valid JSON."
        );
    }
}


/* =========================================================
   EXTRACT ARRAY
   ========================================================= */

function getRows(data) {

    if (Array.isArray(data)) {
        return data;
    }

    const possibleNames = [
        "data",
        "results",
        "result",
        "rows",
        "records"
    ];

    for (const name of possibleNames) {

        if (Array.isArray(data?.[name])) {
            return data[name];
        }

    }

    return [];
}


/* =========================================================
   FIELD FINDER
   ========================================================= */

function field(row, names) {

    for (const name of names) {

        if (
            row &&
            row[name] !== undefined &&
            row[name] !== null &&
            row[name] !== ""
        ) {
            return row[name];
        }

    }

    return null;
}


/* =========================================================
   COUNTRY LIST
   ========================================================= */

async function loadCountries() {

    clearError();

    const selector = $("country");

    selector.innerHTML =
        "<option>Loading countries...</option>";

    try {

        const url =
            `${API_BASE}/aux`;

        const data =
            await getJSON(url);

        const rows =
            getRows(data);

        const countries =
            new Map();


        for (const row of rows) {

            const code =
                field(
                    row,
                    [
                        "country_code",
                        "countryCode",
                        "countrycode",
                        "code"
                    ]
                );

            const name =
                field(
                    row,
                    [
                        "country_name",
                        "countryName",
                        "countryname",
                        "name"
                    ]
                );

            if (
                code &&
                name
            ) {

                countries.set(
                    String(code),
                    String(name)
                );

            }

        }


        /*
         * Some versions of the auxiliary response
         * use different field structures.
         *
         * If no country list is returned, use the
         * official country codes below as a fallback.
         *
         * These are ONLY country codes/names.
         * Poverty numbers are NEVER hard-coded.
         */

        if (countries.size === 0) {

            const fallbackCountries = [

                ["AFG", "Afghanistan"],
                ["ALB", "Albania"],
                ["DZA", "Algeria"],
                ["ARG", "Argentina"],
                ["AUS", "Australia"],
                ["AUT", "Austria"],
                ["BGD", "Bangladesh"],
                ["BEL", "Belgium"],
                ["BRA", "Brazil"],
                ["CAN", "Canada"],
                ["CHN", "China"],
                ["COL", "Colombia"],
                ["DNK", "Denmark"],
                ["EGY", "Egypt"],
                ["FIN", "Finland"],
                ["FRA", "France"],
                ["DEU", "Germany"],
                ["GHA", "Ghana"],
                ["GRC", "Greece"],
                ["IND", "India"],
                ["IDN", "Indonesia"],
                ["IRL", "Ireland"],
                ["ITA", "Italy"],
                ["JPN", "Japan"],
                ["KEN", "Kenya"],
                ["MEX", "Mexico"],
                ["NLD", "Netherlands"],
                ["NZL", "New Zealand"],
                ["NGA", "Nigeria"],
                ["NOR", "Norway"],
                ["PAK", "Pakistan"],
                ["PER", "Peru"],
                ["PHL", "Philippines"],
                ["POL", "Poland"],
                ["PRT", "Portugal"],
                ["RUS", "Russia"],
                ["SAU", "Saudi Arabia"],
                ["SGP", "Singapore"],
                ["ZAF", "South Africa"],
                ["KOR", "South Korea"],
                ["ESP", "Spain"],
                ["LKA", "Sri Lanka"],
                ["SWE", "Sweden"],
                ["CHE", "Switzerland"],
                ["TZA", "Tanzania"],
                ["THA", "Thailand"],
                ["TUR", "Türkiye"],
                ["UGA", "Uganda"],
                ["UKR", "Ukraine"],
                ["ARE", "United Arab Emirates"],
                ["GBR", "United Kingdom"],
                ["USA", "United States"],
                ["VNM", "Vietnam"],
                ["ZMB", "Zambia"],
                ["ZWE", "Zimbabwe"]

            ];


            for (
                const [code, name]
                of fallbackCountries
            ) {

                countries.set(
                    code,
                    name
                );

            }

        }


        const sorted =
            Array.from(
                countries.entries()
            )
            .sort(
                (a, b) =>
                    a[1].localeCompare(b[1])
            );


        selector.innerHTML = "";


        for (
            const [code, name]
            of sorted
        ) {

            const option =
                document.createElement("option");

            option.value = code;

            option.textContent =
                `${name} (${code})`;

            selector.appendChild(option);

        }


        /*
         * Start with India because it is a useful
         * test country and the World Bank currently
         * reports a 2022 observation for it.
         */

        if (
            countries.has("IND")
        ) {

            selector.value = "IND";

            await loadCountry("IND");

        } else {

            await loadCountry(
                sorted[0][0]
            );

        }

    } catch (error) {

        /*
         * We still allow the application to work
         * using the country-code fallback above.
         */

        console.error(error);

        showError(
            "The World Bank country directory could not be loaded. " +
            "The app is using its built-in country list. " +
            "Poverty figures will still be requested directly " +
            "from the World Bank PIP API."
        );


        const fallback =
            [
                ["IND", "India"],
                ["USA", "United States"],
                ["GBR", "United Kingdom"],
                ["FRA", "France"],
                ["BRA", "Brazil"],
                ["ZAF", "South Africa"],
                ["NGA", "Nigeria"],
                ["CHN", "China"]
            ];


        selector.innerHTML = "";


        fallback.forEach(
            ([code, name]) => {

                const option =
                    document.createElement("option");

                option.value = code;

                option.textContent =
                    `${name} (${code})`;

                selector.appendChild(option);

            }
        );


        selector.value = "IND";

        await loadCountry("IND");

    }

}


/* =========================================================
   LOAD COUNTRY POVERTY DATA
   ========================================================= */

async function loadCountry(code) {

    clearError();


    $("rate").textContent =
        "Loading...";

    $("poorPop").textContent =
        "Loading...";

    $("change").textContent =
        "Loading...";

    $("status").textContent =
        "Loading...";


    try {

        /*
         * Main World Bank PIP endpoint.
         *
         * We request:
         * - country
         * - $3.00/day poverty line
         */

        const url =
            new URL(
                `${API_BASE}/pip`
            );


        url.searchParams.set(
            "country_code",
            code
        );


        url.searchParams.set(
            "poverty_line",
            POVERTY_LINE
        );


        const data =
            await getJSON(
                url.toString()
            );


        const rawRows =
            getRows(data);


        if (
            rawRows.length === 0
        ) {

            throw new Error(
                `No poverty observations were returned for ${code}.`
            );

        }


        const rows =
            rawRows
                .map(normalizeRow)
                .filter(
                    row =>
                        row.year !== null &&
                        row.rate !== null
                )
                .sort(
                    (a, b) =>
                        a.year - b.year
                );


        if (
            rows.length === 0
        ) {

            throw new Error(
                `The World Bank returned data for ${code}, ` +
                `but no usable $3.00/day poverty observations ` +
                `were found.`
            );

        }


        render(rows);

    } catch (error) {

        console.error(
            "PIP error:",
            error
        );


        $("rate").textContent =
            "Unavailable";

        $("poorPop").textContent =
            "Unavailable";

        $("change").textContent =
            "Unavailable";

        $("status").textContent =
            "Unavailable";


        $("rateYear").textContent =
            "No usable observation";

        $("poorYear").textContent =
            "No usable observation";

        $("changeType").textContent =
            "—";

        $("statusDetail").textContent =
            "—";


        showError(
            "The World Bank PIP data could not be loaded for " +
            code +
            ". " +
            error.message
        );

    }

}


/* =========================================================
   NORMALIZE PIP ROW
   ========================================================= */

function normalizeRow(row) {

    /*
     * Different PIP responses can expose fields
     * with slightly different names.
     */

    const yearValue =
        field(
            row,
            [
                "reporting_year",
                "reportingYear",
                "year",
                "survey_year",
                "surveyYear"
            ]
        );


    const rateValue =
        field(
            row,
            [
                "headcount",
                "headcount_ratio",
                "headcountRatio",
                "poverty_rate",
                "povertyRate",
                "hc"
            ]
        );


    const poorValue =
        field(
            row,
            [
                "poor",
                "poor_pop",
                "poor_population",
                "poorpop"
            ]
        );


    const typeValue =
        field(
            row,
            [
                "reporting_level",
                "reportingLevel",
                "data_type",
                "dataType",
                "survey_type",
                "type"
            ]
        );


    const year =
        Number(yearValue);


    const rate =
        Number(rateValue);


    let poor = null;


    if (
        poorValue !== null &&
        Number.isFinite(
            Number(poorValue)
        )
    ) {

        poor =
            Number(poorValue);

    }


    return {

        year:
            Number.isFinite(year)
                ? year
                : null,

        rate:
            Number.isFinite(rate)
                ? rate
                : null,

        poor,

        type:
            typeValue ||
            "World Bank PIP observation"

    };

}


/* =========================================================
   RENDER DASHBOARD
   ========================================================= */

function render(rows) {

    const latest =
        rows[
            rows.length - 1
        ];


    const previous =
        rows.length > 1
            ? rows[
                rows.length - 2
            ]
            : null;


    /*
     * Latest rate
     */

    $("rate").textContent =
        `${number(latest.rate)}%`;


    $("rateYear").textContent =
        `Latest available observation: ${latest.year}`;


    /*
     * Population
     */

    $("poorPop").textContent =
        population(
            latest.poor
        );


    $("poorYear").textContent =
        latest.poor === null
            ? "PIP population field unavailable"
            : `Associated observation: ${latest.year}`;


    /*
     * Change
     */

    if (previous) {

        const difference =
            latest.rate -
            previous.rate;


        const percentChange =
            previous.rate !== 0
                ? (
                    difference /
                    previous.rate
                ) * 100
                : null;


        $("change").textContent =
            `${difference >= 0 ? "+" : ""}` +
            `${number(difference)} percentage points`;


        $("changeType").textContent =
            percentChange === null
                ? "Relative percentage change unavailable"
                :
                `${percentChange >= 0 ? "+" : ""}` +
                `${number(percentChange)}% ` +
                `since ${previous.year}`;


        if (
            difference > 0.1
        ) {

            $("status").textContent =
                "Increasing";

        } else if (
            difference < -0.1
        ) {

            $("status").textContent =
                "Decreasing";

        } else {

            $("status").textContent =
                "Stable";

        }


        $("statusDetail").textContent =
            `Compared with ${previous.year}`;

    } else {

        $("change").textContent =
            "Unavailable";

        $("changeType").textContent =
            "Only one observation";

        $("status").textContent =
            "Unavailable";

        $("statusDetail").textContent =
            "More observations required";

    }


    /*
     * Table
     */

    $("dataTable").innerHTML =
        rows
            .slice()
            .reverse()
            .map(
                row => `

                <tr>

                    <td>
                        ${row.year}
                    </td>

                    <td>
                        ${number(row.rate)}%
                    </td>

                    <td>
                        ${
                            population(
                                row.poor
                            )
                        }
                    </td>

                    <td>
                        ${
                            row.type
                        }
                    </td>

                </tr>

                `
            )
            .join("");


    /*
     * Charts
     */

    drawCharts(rows);

}


/* =========================================================
   DRAW CHARTS
   ========================================================= */

function drawCharts(rows) {

    const labels =
        rows.map(
            row =>
                String(row.year)
        );


    const rates =
        rows.map(
            row =>
                row.rate
        );


    const poor =
        rows.map(
            row =>
                row.poor
        );


    /*
     * Poverty-rate chart
     */

    if (
        povertyChart
    ) {

        povertyChart.destroy();

    }


    povertyChart =
        new Chart(
            $("povertyChart"),
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                "Poverty rate (%)",

                            data:
                                rates,

                            tension:
                                0.25,

                            borderWidth:
                                2,

                            pointRadius:
                                3

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            title: {

                                display:
                                    true,

                                text:
                                    "Population (%)"

                            }

                        }

                    }

                }

            }
        );


    /*
     * People-in-poverty chart
     */

    if (
        peopleChart
    ) {

        peopleChart.destroy();

    }


    peopleChart =
        new Chart(
            $("peopleChart"),
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                "People in poverty",

                            data:
                                poor,

                            tension:
                                0.25,

                            borderWidth:
                                2,

                            pointRadius:
                                3

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            title: {

                                display:
                                    true,

                                text:
                                    "People"

                            }

                        }

                    }

                }

            }
        );

}


/* =========================================================
   COUNTRY SELECTOR
   ========================================================= */

$("country").addEventListener(
    "change",
    event => {

        loadCountry(
            event.target.value
        );

    }
);


/* =========================================================
   REFRESH BUTTON
   ========================================================= */

$("refresh").addEventListener(
    "click",
    () => {

        loadCountry(
            $("country").value
        );

    }
);


/* =========================================================
   SERVICE WORKER
   ========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register(
                    "./service-worker.js"
                )
                .then(
                    registration => {

                        console.log(
                            "Poverty Tracker service worker active.",
                            registration.scope
                        );

                    }
                )
                .catch(
                    error => {

                        console.warn(
                            "Service worker unavailable:",
                            error
                        );

                    }
                );

        }
    );

}


/* =========================================================
   START
   ========================================================= */

loadCountries();
