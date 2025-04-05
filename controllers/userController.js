

const pageNotFound = async (req, res) => {
    try {

        res.render("pageNotFound")

    } catch (error) {

        res.redirect("/pageNotFound")

    }
}



const loadHomePage = async (req, res) => {
    try {
        const products = []
        return res.render("home", { products })

    } catch (error) {

        console.log("homePage not found")
        res.status(500).send("server error")

    }
}

module.exports = {
    loadHomePage,
    pageNotFound,
} 