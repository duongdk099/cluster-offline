use image::{imageops::FilterType, load_from_memory, DynamicImage};
use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

// Helper to reliably map any Rust parsing or sizing errors directly into JS Exceptions
fn to_js_error(err: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&format!("Image Processing Error: {}", err))
}

// A simple struct holding the pixels and dimensions that JS can read easily
#[wasm_bindgen]
pub struct ProcessedImage {
    pub width: u32,
    pub height: u32,
    pixels: Vec<u8>,
}

#[wasm_bindgen]
impl ProcessedImage {
    // JS calls this to grab the image bytes (RGBA array)
    pub fn get_pixels(&self) -> Uint8Array {
        Uint8Array::from(self.pixels.as_slice())
    }
}

// Internal helper to convert `DynamicImage` to our `ProcessedImage` struct
fn to_processed_image(img: DynamicImage) -> ProcessedImage {
    let width = img.width();
    let height = img.height();
    let pixels = img.into_rgba8().into_raw(); // Pure RGBA array

    ProcessedImage {
        width,
        height,
        pixels,
    }
}

#[wasm_bindgen]
pub fn resize_image(
    image_data: &[u8], // Borrowed! No cloning from JS.
    max_width: u32,
) -> Result<ProcessedImage, JsValue> {
    // Decode JPEG/PNG
    let img = load_from_memory(image_data).map_err(to_js_error)?;

    let final_img = if img.width() > max_width {
        let aspect_ratio = img.height() as f32 / img.width() as f32;
        let new_height = (max_width as f32 * aspect_ratio) as u32;

        img.resize(max_width, new_height, FilterType::Lanczos3)
    } else {
        img
    };

    Ok(to_processed_image(final_img))
}

#[wasm_bindgen]
pub fn crop_image(
    image_data: &[u8], // Will likely be a WebP decoded back to pixels by Rust
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<ProcessedImage, JsValue> {
    let mut img = load_from_memory(image_data).map_err(to_js_error)?;
    let cropped = img.crop(x, y, width, height);
    
    Ok(to_processed_image(cropped))
}

#[wasm_bindgen]
pub fn rotate_image(
    image_data: &[u8],
    degrees: u16,
) -> Result<ProcessedImage, JsValue> {
    let img = load_from_memory(image_data).map_err(to_js_error)?;

    let rotated = match degrees {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => img,
    };

    Ok(to_processed_image(rotated))
}
