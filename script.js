const API_BASE = "https://pip.worldbank.org/pip/v1";

const POVERTY_LINE = 3.00;

let povertyChart = null;
let peopleChart = null;


/* =====================================================
   HELPERS
   ===================================================== */

const $ = (id) => document.getElementById(id);


function showError(message) {

    $("error").textContent = message;

    $("error").classList.remove("hidden");

}


function clearError() {

    $("error").classList.add("hidden");

}


function formatNumber(value) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {

        return "—";

    }

    return new Intl.NumberFormat(
        undefined,
        {
            maximumFractionDigits: 1
        }
    ).format(Number(value));

}


function formatPopulation(value) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {

        return "—";

    }

    const number = Number(value);

    if (number >= 1000000) {

        return (
            formatNumber(number / 1000000)
            + " million"
        );

    }

    return formatNumber(number);

}


/* =====================================================
   API REQUEST
   ===================================================== */

async function apiRequest(
    endpoint,
    parameters = {}
) {

    const url =
        new URL(
            `${API_BASE}/${endpoint}`
        );


    Object.entries(parameters).forEach(
        ([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {

                url.searchParams.set(
                    key,
                    value
                );

            }

        }
    );


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `World Bank API returned HTTP ${response.status}`
        );

    }


    return response.json();

}


/* =====================================================
   FIND ARRAY IN API RESPONSE
   ===================================================== */

function unwrapData(json) {

    if (Array.isArray(json)) {

        return json;

    }


    const possibleFields = [
        "data",
        "result",
        "results",
        "rows",
        "records"
    ];


    for (
        const field of possibleFields
    ) {

        if (
            Array.isArray(
                json?.[field]
            )
        ) {

            return json[field];

        }

    }


    return [];

}


/* =====================================================
   FIND FIELD
   ===================================================== */

function firstValue(
    object,
    fields
) {

    for (
        const field of fields
    ) {

        if (
            object &&
            object[field] !== undefined &&
            object[field] !== null &&
            object[field] !== ""
        ) {

            return object[field];

        }

    }


    return null;

}


/* =====================================================
   NORMALIZE DATA
   ===================================================== */

function normalizeRow(row) {

    const country =
        firstValue(
            row,
            [
                "country_code",
                "countrycode",
                "countryCode",
                "code",
                "country"
            ]
        );


    const year =
        Number(
            firstValue(
                row,
                [
                    "reporting_year",
                    "year",
                    "survey_year",
                    "reportingYear"
                ]
            )
        );


    const rateValue =
        firstValue(
            row,
            [
                "headcount",
                "headcount_ratio",
                "poverty_rate",
                "povertyRate",
                "hc"
            ]
        );


    const rate =
        Number(rateValue);


    const population =
        firstValue(
            row,
            [
                "poor",
                "poorpop",
                "poor_population",
                "poor_pop"
            ]
        );


    const dataType =
        firstValue(
            row,
            [
                "data_type",
                "dataType",
                "type",
                "estimation_type",
                "estimate_type"
            ]
        );


    return {

        country,

        year:
            Number.isFinite(year)
                ? year
                : null,

        rate:
            Number.isFinite(rate)
                ? rate
                : null,

        population:
            population === null
                ? null
                : Number(population),

        dataType:
            dataType ||
            "Published PIP observation"

    };

}


/* =====================================================
   LOAD COUNTRIES
   ===================================================== */

async function loadCountries() {

    try {

        const json =
            await apiRequest("aux");


        const rows =
            unwrapData(json);


        const countries =
            new Map();


        rows.forEach(
            (row) => {

                const code =
                    firstValue(
                        row,
                        [
                            "country_code",
                            "countrycode",
                            "countryCode",
                            "code"
                        ]
                    );


                const name =
                    firstValue(
                        row,
                        [
                            "country_name",
                            "countryname",
                            "name",
                            "country"
                        ]
                    );


                if (
                    code &&
                    name
                ) {

                    countries.set(
                        code,
                        {
                            code,
                            name
                        }
                    );

                }

            }
        );


        const list =
            Array.from(
                countries.values()
            ).sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );


        if (!list.length) {

            throw new Error(
                "No country data was returned."
            );

        }


        const selector =
            $("country");


        selector.innerHTML = "";


        list.forEach(
            (country) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    country.code;


                option.textContent =
                    `${country.name} (${country.code})`;


                selector.appendChild(
                    option
                );

            }
        );


        await loadCountry(
            list[0].code
        );

    }

    catch (error) {

        showError(
            "The World Bank country list could not be loaded. " +
            error.message
        );

    }

}


/* =====================================================
   LOAD COUNTRY
   ===================================================== */

async function loadCountry(
    countryCode
) {

    clearError();


    $("rate").textContent =
        "Loading...";

    $("poorPop").textContent =
        "Loading...";


    try {

        let json;


        try {

            json =
                await apiRequest(
                    "pip",
                    {
                        country_code:
                            countryCode,

                        poverty_line:
                            POVERTY_LINE
                    }
                );

        }

        catch {

            json =
                await apiRequest(
                    "pip",
                    {
                        country_code:
                            countryCode
                    }
                );

        }


        const rows =
            unwrapData(json)
                .map(normalizeRow)
                .filter(
                    row =>
                        row.year &&
                        row.rate !== null
                )
                .sort(
                    (a, b) =>
                        a.year - b.year
                );


        if (!rows.length) {

            throw new Error(
                "No usable poverty observations were returned."
            );

        }


        renderDashboard(rows);

    }

    catch (error) {

        showError(
            "Unable to load usable poverty data. " +
            error.message
        );


        $("rate").textContent =
            "Unavailable";

        $("poorPop").textContent =
            "Unavailable";

        $("change").textContent =
            "—";

        $("status").textContent =
            "—";

    }

}


/* =====================================================
   RENDER DASHBOARD
   ===================================================== */

function renderDashboard(rows) {

    const latest =
        rows[rows.length - 1];


    const previous =
        rows.length > 1
            ? rows[rows.length - 2]
            : null;


    $("rate").textContent =
        latest.rate === null
            ? "—"
            : `${formatNumber(latest.rate)}%`;


    $("rateYear").textContent =
        `Latest available: ${latest.year}`;


    $("poorPop").textContent =
        formatPopulation(
            latest.population
        );


    $("poorYear").textContent =
        latest.population === null
            ? "Population field unavailable"
            : `Latest available: ${latest.year}`;


    /* =================================================
       CHANGE
       ================================================= */

    if (previous) {

        const difference =
            latest.rate -
            previous.rate;


        const percentageChange =
            previous.rate !== 0
                ? (
                    difference /
                    previous.rate
                ) * 100
                : null;


        $("change").textContent =
            `${difference > 0 ? "+" : ""}` +
            `${formatNumber(difference)} pp`;


        $("changeType").textContent =
            percentageChange === null
                ? "Percentage change unavailable"
                :
                `${percentageChange > 0 ? "+" : ""}` +
                `${formatNumber(percentageChange)}%`;


        if (
            Math.abs(difference) < 0.1
        ) {

            $("status").textContent =
                "Stable";

        }

        else if (
            difference < 0
        ) {

            $("status").textContent =
                "Decreasing";

        }

        else {

            $("status").textContent =
                "Increasing";

        }


        $("statusDetail").textContent =
            `Compared with ${previous.year}`;

    }

    else {

        $("change").textContent =
            "—";

        $("changeType").textContent =
            "Not enough observations";

        $("status").textContent =
            "—";

    }


    /* =================================================
       TABLE
       ================================================= */

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
                        ${formatNumber(row.rate)}%
                    </td>

                    <td>
                        ${formatPopulation(
                            row.population
                        )}
                    </td>

                    <td>
                        ${row.dataType}
                    </td>

                </tr>

                `
            )
            .join("");


    /* =================================================
       GRAPH DATA
       ================================================= */

    const labels =
        rows.map(
            row => String(row.year)
        );


    const rates =
        rows.map(
            row => row.rate
        );


    const populations =
        rows.map(
            row => row.population
        );


    /* =================================================
       POVERTY GRAPH
       ================================================= */

    if (povertyChart) {

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
                                "Poverty Rate (%)",

                            data:
                                rates,

                            tension:
                                0.25,

                            spanGaps:
                                false

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    plugins: {

                        legend: {

                            display:
                                true

                        }

                    },

                    scales: {

                        y: {

                            beginAtZero:
                                true

                        }

                    }

                }

            }
        );


    /* =================================================
       POPULATION GRAPH
       ================================================= */

    if (peopleChart) {

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
                                "People in Poverty",

                            data:
                                populations,

                            tension:
                                0.25,

                            spanGaps:
                                false

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    plugins: {

                        legend: {

                            display:
                                true

                        }

                    },

                    scales: {

                        y: {

                            beginAtZero:
                                true

                        }

                    }

                }

            }
        );

}


/* =====================================================
   REFRESH
   ===================================================== */

$("refresh").addEventListener(
    "click",
    () => {

        loadCountry(
            $("country").value
        );

    }
);


/* =====================================================
   COUNTRY CHANGE
   ===================================================== */

$("country").addEventListener(
    "change",
    (event) => {

        loadCountry(
            event.target.value
        );

    }
);


/* =====================================================
   PROGRESSIVE WEB APP
   ===================================================== */

if (
    "serviceWorker"
    in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register(
                    "./service-worker.js"
                )
                .then(
                    () => {

                        console.log(
                            "Global Poverty Tracker app is ready."
                        );

                    }
                )
                .catch(
                    error => {

                        console.error(
                            "Service worker error:",
                            error
                        );

                    }
                );

        }
    );

}


/* =====================================================
   START APPLICATION
   ===================================================== */

loadCountries();
