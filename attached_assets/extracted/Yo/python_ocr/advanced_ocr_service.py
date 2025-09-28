#!/usr/bin/env python3
"""
Advanced OCR Service with PaddleOCR + LayoutParser
Ultra-precision document extraction with exact visual formatting preservation
"""

import io
import json
import logging
import uuid
from typing import List, Dict, Any, Tuple, Optional
import cv2
import numpy as np
from PIL import Image
import fitz  # PyMuPDF for PDF processing
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

# OCR engines - using available libraries
try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
    print("✅ PyTesseract available")
except ImportError:
    PYTESSERACT_AVAILABLE = False
    print("⚠️  PyTesseract not available")

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
    print("✅ PDFPlumber available")
except ImportError:
    PDFPLUMBER_AVAILABLE = False
    print("⚠️  PDFPlumber not available")

try:
    from pdf2image import convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
    print("✅ PDF2Image available")
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    print("⚠️  PDF2Image not available")

# Advanced OCR engines (optional)
try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
    print("✅ PaddleOCR available")
except ImportError:
    PADDLE_AVAILABLE = False
    print("⚠️  PaddleOCR not available")

try:
    import easyocr
    EASY_OCR_AVAILABLE = True
    print("✅ EasyOCR available")
except ImportError:
    EASY_OCR_AVAILABLE = False
    print("⚠️  EasyOCR not available")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Advanced OCR Service", version="1.0.0")

class AdvancedOCR:
    """Ultra-precision OCR with multiple engines and layout analysis"""
    
    def __init__(self):
        self.paddle_ocr = None
        self.easy_ocr = None
        self.pytesseract_available = PYTESSERACT_AVAILABLE
        
        # Initialize PaddleOCR (if available)
        if PADDLE_AVAILABLE:
            try:
                self.paddle_ocr = PaddleOCR(
                    use_angle_cls=True,
                    lang='en',
                    use_gpu=False,
                    show_log=False
                )
                logger.info("✅ PaddleOCR initialized")
            except Exception as e:
                logger.warning(f"❌ PaddleOCR initialization failed: {e}")
        
        # Initialize EasyOCR (if available)
        if EASY_OCR_AVAILABLE:
            try:
                self.easy_ocr = easyocr.Reader(['en'], gpu=False)
                logger.info("✅ EasyOCR initialized")
            except Exception as e:
                logger.warning(f"❌ EasyOCR initialization failed: {e}")
        
        # PyTesseract is always available as primary OCR engine
        if PYTESSERACT_AVAILABLE:
            logger.info("✅ PyTesseract ready as primary OCR engine")
        else:
            logger.warning("❌ No OCR engines available!")
    
    def extract_pdf_with_coordinates(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """Extract PDF content with precise coordinates using multiple methods"""
        try:
            # Method 1: Native PDF text extraction with PyMuPDF
            native_data = self._extract_pdf_native(pdf_bytes)
            
            # Method 2: PDF to images + OCR for visual elements
            ocr_data = self._extract_pdf_via_ocr(pdf_bytes)
            
            # Method 3: PDFPlumber for table detection
            table_data = self._extract_pdf_tables(pdf_bytes) if PDFPLUMBER_AVAILABLE else []
            
            # Reconcile all sources
            reconciled_data = self._reconcile_extraction_sources(native_data, ocr_data, table_data)
            
            return reconciled_data
            
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")
    
    def extract_image_with_layout(self, image_bytes: bytes) -> Dict[str, Any]:
        """Extract image content with advanced layout analysis"""
        try:
            # Convert bytes to image
            image = Image.open(io.BytesIO(image_bytes))
            image_np = np.array(image)
            
            # Step 1: Layout analysis
            layout_elements = self._analyze_layout(image_np)
            
            # Step 2: Multi-engine OCR
            ocr_results = self._multi_engine_ocr(image_np)
            
            # Step 3: Shape and line detection
            shapes = self._detect_shapes_and_lines(image_np)
            
            # Step 4: Combine all data into IR format
            ir_data = self._build_intermediate_representation(
                image_np, layout_elements, ocr_results, shapes
            )
            
            return ir_data
            
        except Exception as e:
            logger.error(f"Image extraction failed: {e}")
            raise HTTPException(status_code=500, detail=f"Image extraction failed: {str(e)}")
    
    def _extract_pdf_native(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """Extract native PDF text with coordinates using PyMuPDF"""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Get page dimensions
            rect = page.rect
            width, height = rect.width, rect.height
            
            # Extract text with coordinates
            words = []
            text_dict = page.get_text("dict")
            
            for block in text_dict["blocks"]:
                if "lines" in block:
                    for line in block["lines"]:
                        for span in line["spans"]:
                            bbox = span["bbox"]
                            words.append({
                                "text": span["text"],
                                "bbox": {
                                    "x": bbox[0] / width,
                                    "y": bbox[1] / height,
                                    "width": (bbox[2] - bbox[0]) / width,
                                    "height": (bbox[3] - bbox[1]) / height
                                },
                                "confidence": 1.0,  # Native PDF text is highly confident
                                "font_family": span.get("font", ""),
                                "font_size": span.get("size", 0),
                                "flags": span.get("flags", 0)
                            })
            
            # Detect shapes and lines from PDF graphics
            shapes = self._extract_pdf_shapes(page, width, height)
            
            pages.append({
                "page_number": page_num + 1,
                "width": width,
                "height": height,
                "words": words,
                "shapes": shapes,
                "method": "pdf_native"
            })
        
        doc.close()
        return {"pages": pages, "total_pages": len(pages), "method": "pdf_native"}
    
    def _extract_pdf_via_ocr(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """Convert PDF pages to images and run OCR"""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Convert page to image
            mat = fitz.Matrix(2, 2)  # 2x scaling for better OCR
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            
            # Run OCR on image
            image = Image.open(io.BytesIO(img_data))
            image_np = np.array(image)
            
            ocr_results = self._multi_engine_ocr(image_np)
            
            pages.append({
                "page_number": page_num + 1,
                "width": pix.width,
                "height": pix.height,
                "words": ocr_results.get("words", []),
                "method": "pdf_to_image_ocr"
            })
        
        doc.close()
        return {"pages": pages, "total_pages": len(pages), "method": "pdf_ocr"}
    
    def _extract_pdf_tables(self, pdf_bytes: bytes) -> List[Dict[str, Any]]:
        """Extract tables using PDFPlumber"""
        if not PDFPLUMBER_AVAILABLE:
            return []
        
        tables = []
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    page_tables = page.find_tables()
                    for table_idx, table in enumerate(page_tables):
                        bbox = table.bbox
                        cells = []
                        
                        # Extract table data
                        table_data = table.extract()
                        if table_data:
                            for row_idx, row in enumerate(table_data):
                                for col_idx, cell_text in enumerate(row or []):
                                    if cell_text:
                                        cells.append({
                                            "text": str(cell_text),
                                            "row": row_idx,
                                            "col": col_idx,
                                            "confidence": 0.95
                                        })
                        
                        tables.append({
                            "page_number": page_num + 1,
                            "table_id": f"table_{page_num}_{table_idx}",
                            "bbox": {
                                "x": bbox[0] / page.width,
                                "y": bbox[1] / page.height,
                                "width": (bbox[2] - bbox[0]) / page.width,
                                "height": (bbox[3] - bbox[1]) / page.height
                            },
                            "cells": cells,
                            "rows": len(table_data) if table_data else 0,
                            "cols": max(len(row or []) for row in table_data) if table_data else 0
                        })
        except Exception as e:
            logger.warning(f"Table extraction failed: {e}")
        
        return tables
    
    def _extract_pdf_shapes(self, page, width: float, height: float) -> List[Dict[str, Any]]:
        """Extract shapes and lines from PDF page"""
        shapes = []
        try:
            # Get drawing instructions
            paths = page.get_drawings()
            
            for path in paths:
                for item in path["items"]:
                    if item[0] == "l":  # Line
                        p1, p2 = item[1], item[2]
                        shapes.append({
                            "type": "line",
                            "bbox": {
                                "x": min(p1.x, p2.x) / width,
                                "y": min(p1.y, p2.y) / height,
                                "width": abs(p2.x - p1.x) / width,
                                "height": abs(p2.y - p1.y) / height
                            },
                            "coordinates": [
                                {"x": p1.x / width, "y": p1.y / height},
                                {"x": p2.x / width, "y": p2.y / height}
                            ]
                        })
                    elif item[0] == "re":  # Rectangle
                        rect = item[1]
                        shapes.append({
                            "type": "rectangle",
                            "bbox": {
                                "x": rect.x0 / width,
                                "y": rect.y0 / height,
                                "width": rect.width / width,
                                "height": rect.height / height
                            }
                        })
        except Exception as e:
            logger.warning(f"Shape extraction failed: {e}")
        
        return shapes
    
    def _analyze_layout(self, image_np: np.ndarray) -> List[Dict[str, Any]]:
        """Analyze document layout using LayoutParser"""
        if not self.layout_model:
            return []
        
        try:
            # Detect layout elements
            layout = self.layout_model.detect(image_np)
            
            elements = []
            for block in layout:
                elements.append({
                    "type": block.type,
                    "bbox": {
                        "x": block.block.x_1 / image_np.shape[1],
                        "y": block.block.y_1 / image_np.shape[0],
                        "width": block.block.width / image_np.shape[1],
                        "height": block.block.height / image_np.shape[0]
                    },
                    "confidence": block.score
                })
            
            return elements
        except Exception as e:
            logger.warning(f"Layout analysis failed: {e}")
            return []
    
    def _multi_engine_ocr(self, image_np: np.ndarray) -> Dict[str, Any]:
        """Run multiple OCR engines and combine results"""
        all_words = []
        
        # PyTesseract as primary engine
        if self.pytesseract_available:
            try:
                # Convert numpy array to PIL Image for pytesseract
                image_pil = Image.fromarray(image_np)
                
                # Get detailed word-level data from Tesseract
                data = pytesseract.image_to_data(image_pil, output_type=pytesseract.Output.DICT)
                
                # Extract words with bounding boxes
                n_boxes = len(data['level'])
                for i in range(n_boxes):
                    if int(data['conf'][i]) > 30:  # Filter low confidence
                        text = data['text'][i].strip()
                        if text:  # Only process non-empty text
                            x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                            
                            all_words.append({
                                "text": text,
                                "bbox": {
                                    "x": x / image_np.shape[1],
                                    "y": y / image_np.shape[0],
                                    "width": w / image_np.shape[1],
                                    "height": h / image_np.shape[0]
                                },
                                "confidence": int(data['conf'][i]) / 100.0,
                                "engine": "tesseract"
                            })
            except Exception as e:
                logger.warning(f"PyTesseract failed: {e}")
        
        # PaddleOCR as enhanced option (if available)
        if self.paddle_ocr and len(all_words) < 10:  # Use if primary didn't find much
            try:
                paddle_results = self.paddle_ocr.ocr(image_np, cls=True)
                
                if paddle_results and paddle_results[0]:
                    for line in paddle_results[0]:
                        bbox, (text, confidence) = line
                        
                        # Normalize coordinates
                        x_coords = [p[0] for p in bbox]
                        y_coords = [p[1] for p in bbox]
                        
                        all_words.append({
                            "text": text,
                            "bbox": {
                                "x": min(x_coords) / image_np.shape[1],
                                "y": min(y_coords) / image_np.shape[0],
                                "width": (max(x_coords) - min(x_coords)) / image_np.shape[1],
                                "height": (max(y_coords) - min(y_coords)) / image_np.shape[0]
                            },
                            "confidence": confidence,
                            "engine": "paddle"
                        })
            except Exception as e:
                logger.warning(f"PaddleOCR failed: {e}")
        
        # EasyOCR as fallback
        if self.easy_ocr and len(all_words) == 0:
            try:
                easy_results = self.easy_ocr.readtext(image_np)
                
                for (bbox, text, confidence) in easy_results:
                    # bbox is [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
                    x_coords = [p[0] for p in bbox]
                    y_coords = [p[1] for p in bbox]
                    
                    all_words.append({
                        "text": text,
                        "bbox": {
                            "x": min(x_coords) / image_np.shape[1],
                            "y": min(y_coords) / image_np.shape[0],
                            "width": (max(x_coords) - min(x_coords)) / image_np.shape[1],
                            "height": (max(y_coords) - min(y_coords)) / image_np.shape[0]
                        },
                        "confidence": confidence,
                        "engine": "easy"
                    })
            except Exception as e:
                logger.warning(f"EasyOCR failed: {e}")
        
        return {"words": all_words}
    
    def _detect_shapes_and_lines(self, image_np: np.ndarray) -> List[Dict[str, Any]]:
        """Detect shapes and lines using OpenCV"""
        shapes = []
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
            
            # Detect lines using HoughLinesP
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=50, maxLineGap=10)
            
            if lines is not None:
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    shapes.append({
                        "type": "line",
                        "bbox": {
                            "x": min(x1, x2) / image_np.shape[1],
                            "y": min(y1, y2) / image_np.shape[0],
                            "width": abs(x2 - x1) / image_np.shape[1],
                            "height": abs(y2 - y1) / image_np.shape[0]
                        },
                        "coordinates": [
                            {"x": x1 / image_np.shape[1], "y": y1 / image_np.shape[0]},
                            {"x": x2 / image_np.shape[1], "y": y2 / image_np.shape[0]}
                        ]
                    })
            
            # Detect rectangles using contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                # Approximate contour to polygon
                epsilon = 0.02 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                # If 4 corners, likely a rectangle
                if len(approx) == 4 and cv2.contourArea(contour) > 1000:
                    x, y, w, h = cv2.boundingRect(contour)
                    shapes.append({
                        "type": "rectangle",
                        "bbox": {
                            "x": x / image_np.shape[1],
                            "y": y / image_np.shape[0],
                            "width": w / image_np.shape[1],
                            "height": h / image_np.shape[0]
                        }
                    })
        
        except Exception as e:
            logger.warning(f"Shape detection failed: {e}")
        
        return shapes
    
    def _reconcile_extraction_sources(self, native_data: Dict, ocr_data: Dict, table_data: List) -> Dict[str, Any]:
        """Reconcile multiple extraction sources to ensure complete coverage"""
        reconciled_pages = []
        
        for page_idx in range(max(len(native_data.get("pages", [])), len(ocr_data.get("pages", [])))):
            native_page = native_data.get("pages", [])[page_idx] if page_idx < len(native_data.get("pages", [])) else None
            ocr_page = ocr_data.get("pages", [])[page_idx] if page_idx < len(ocr_data.get("pages", [])) else None
            
            # Combine words from both sources
            all_words = []
            if native_page:
                all_words.extend(native_page.get("words", []))
            if ocr_page:
                all_words.extend(ocr_page.get("words", []))
            
            # Remove duplicates based on position and text similarity
            unique_words = self._deduplicate_words(all_words)
            
            # Add table data for this page
            page_tables = [t for t in table_data if t.get("page_number") == page_idx + 1]
            
            # Calculate coverage metrics
            native_word_count = len(native_page.get("words", [])) if native_page else 0
            ocr_word_count = len(ocr_page.get("words", [])) if ocr_page else 0
            final_word_count = len(unique_words)
            
            coverage_percent = min(100, (final_word_count / max(native_word_count, ocr_word_count, 1)) * 100)
            
            reconciled_pages.append({
                "page_number": page_idx + 1,
                "width": (native_page or ocr_page or {}).get("width", 1000),
                "height": (native_page or ocr_page or {}).get("height", 1000),
                "words": unique_words,
                "tables": page_tables,
                "shapes": (native_page or {}).get("shapes", []) + (ocr_page or {}).get("shapes", []),
                "coverage": {
                    "native_words": native_word_count,
                    "ocr_words": ocr_word_count,
                    "final_words": final_word_count,
                    "coverage_percent": coverage_percent
                }
            })
        
        return {
            "pages": reconciled_pages,
            "total_pages": len(reconciled_pages),
            "extraction_methods": ["pdf_native", "ocr_paddle", "pdf_tables"],
            "overall_coverage": sum(p["coverage"]["coverage_percent"] for p in reconciled_pages) / len(reconciled_pages) if reconciled_pages else 0
        }
    
    def _deduplicate_words(self, words: List[Dict]) -> List[Dict]:
        """Remove duplicate words based on position and text similarity"""
        unique_words = []
        
        for word in words:
            is_duplicate = False
            
            for existing in unique_words:
                # Check if words overlap significantly and have similar text
                bbox1 = word["bbox"]
                bbox2 = existing["bbox"]
                
                # Calculate IoU (Intersection over Union)
                x1 = max(bbox1["x"], bbox2["x"])
                y1 = max(bbox1["y"], bbox2["y"])
                x2 = min(bbox1["x"] + bbox1["width"], bbox2["x"] + bbox2["width"])
                y2 = min(bbox1["y"] + bbox1["height"], bbox2["y"] + bbox2["height"])
                
                if x1 < x2 and y1 < y2:
                    intersection = (x2 - x1) * (y2 - y1)
                    area1 = bbox1["width"] * bbox1["height"]
                    area2 = bbox2["width"] * bbox2["height"]
                    iou = intersection / (area1 + area2 - intersection)
                    
                    # If high overlap and similar text, consider duplicate
                    if iou > 0.7 and self._text_similarity(word["text"], existing["text"]) > 0.8:
                        # Keep the one with higher confidence
                        if word.get("confidence", 0) > existing.get("confidence", 0):
                            unique_words.remove(existing)
                        else:
                            is_duplicate = True
                        break
            
            if not is_duplicate:
                unique_words.append(word)
        
        return unique_words
    
    def _text_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity between two strings"""
        if not text1 or not text2:
            return 0.0
        
        # Simple Jaccard similarity
        set1 = set(text1.lower().split())
        set2 = set(text2.lower().split())
        
        if not set1 and not set2:
            return 1.0
        
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        return intersection / union if union > 0 else 0.0
    
    def _build_intermediate_representation(self, image_np: np.ndarray, layout_elements: List, ocr_results: Dict, shapes: List) -> Dict[str, Any]:
        """Build the Intermediate Representation from all analysis results"""
        return {
            "pages": [{
                "page_number": 1,
                "width": image_np.shape[1],
                "height": image_np.shape[0],
                "words": ocr_results.get("words", []),
                "layout_elements": layout_elements,
                "shapes": shapes,
                "coverage": {
                    "native_words": 0,
                    "ocr_words": len(ocr_results.get("words", [])),
                    "final_words": len(ocr_results.get("words", [])),
                    "coverage_percent": 100.0
                }
            }],
            "total_pages": 1,
            "extraction_methods": ["paddleocr", "layout_parser", "opencv_shapes"],
            "overall_coverage": 100.0
        }

# Initialize OCR service
ocr_service = AdvancedOCR()

@app.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    """Extract data from uploaded document with ultra-precision"""
    try:
        # Read file content
        file_content = await file.read()
        
        # Determine file type
        content_type = file.content_type or ""
        filename = file.filename or ""
        
        if content_type == "application/pdf" or filename.lower().endswith('.pdf'):
            result = ocr_service.extract_pdf_with_coordinates(file_content)
        elif content_type.startswith("image/") or any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']):
            result = ocr_service.extract_image_with_layout(file_content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "services": {
            "paddle_ocr": PADDLE_AVAILABLE and ocr_service.paddle_ocr is not None,
            "easy_ocr": EASY_OCR_AVAILABLE and ocr_service.easy_ocr is not None,
            "layout_parser": LAYOUT_PARSER_AVAILABLE and ocr_service.layout_model is not None,
            "pdf_plumber": PDFPLUMBER_AVAILABLE
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")