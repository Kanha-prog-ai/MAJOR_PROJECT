const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

const geocodingClient = mbxGeocoding({ accessToken: process.env.MAP_TOKEN });

// turns "Malibu, United States" into { type: "Point", coordinates: [lng, lat] }
const getGeometry = async (location, country) => {
  try {
    const response = await geocodingClient
      .forwardGeocode({
        query: `${location}, ${country}`,
        limit: 1,
      })
      .send();

    const feature = response.body.features[0];
    return feature ? feature.geometry : undefined;
  } catch (err) {
    console.log("Geocoding failed:", err.message);
    return undefined;
  }
};

module.exports.index = async (req, res) => {
  const { category, q, country } = req.query;
  const query = {};

  if (typeof category === "string" && category) {
    query.category = category;
  }

  if (typeof country === "string" && country) {
    query.country = country;
  }

  if (typeof q === "string" && q.trim()) {
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    query.$or = [
      { title: regex },
      { location: regex },
      { country: regex },
      { category: regex },
    ];
  }

  const allListings = await Listing.find(query);

  // unique country names for the dropdown, sorted A to Z
  const countries = (await Listing.distinct("country"))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  res.render("listings/index.ejs", { allListings, category, q, country, countries });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res) => {
  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;

  // if a photo was uploaded, use the Cloudinary link
  if (req.file) {
    newListing.image = {
      url: req.file.path,
      filename: req.file.filename,
    };
  }

  // coordinates for the map
  const geometry = await getGeometry(
    req.body.listing.location,
    req.body.listing.country
  );
  if (geometry) {
    newListing.geometry = geometry;
  }

  await newListing.save();
  req.flash("success", "New listing created!");
  res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  res.render("listings/edit.ejs", { listing });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(
    id,
    { ...req.body.listing },
    { new: true }
  );

  // if a new photo was uploaded, replace the old image
  if (req.file) {
    listing.image = {
      url: req.file.path,
      filename: req.file.filename,
    };
  }

  // refresh the coordinates in case the location changed
  const geometry = await getGeometry(listing.location, listing.country);
  if (geometry) {
    listing.geometry = geometry;
  }

  await listing.save();
  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};