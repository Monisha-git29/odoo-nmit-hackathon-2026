import os
import math
import base64
import cv2
import numpy as np
import tensorflow as tf

class FaceVerifier:
    def __init__(self):
        self.base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self.front_model_path = os.path.join(self.base_dir, "face_detection_front.tflite")
        self.back_model_path = os.path.join(self.base_dir, "face_detection_back.tflite")
        self.facenet_model_path = os.path.join(self.base_dir, "mobilefacenet.tflite")
        
        # Load interpreters
        self.front_interpreter = self._load_interpreter(self.front_model_path)
        self.back_interpreter = self._load_interpreter(self.back_model_path)
        self.facenet_interpreter = self._load_interpreter(self.facenet_model_path)
        
        # Generate anchors
        self.anchors_128 = self._generate_anchors({
            "num_layers": 4,
            "strides": [8, 16, 16, 16],
            "min_scale": 0.1484375,
            "max_scale": 0.75,
            "input_size_height": 128,
            "input_size_width": 128,
            "anchor_offset_x": 0.5,
            "anchor_offset_y": 0.5,
            "aspect_ratios": [1.0],
            "interpolated_scale_aspect_ratio": 1.0,
        })
        
        self.anchors_256 = self._generate_anchors({
            "num_layers": 4,
            "strides": [16, 32, 32, 32],
            "min_scale": 0.15625,
            "max_scale": 0.75,
            "input_size_height": 256,
            "input_size_width": 256,
            "anchor_offset_x": 0.5,
            "anchor_offset_y": 0.5,
            "aspect_ratios": [1.0],
            "interpolated_scale_aspect_ratio": 1.0,
        })

    def _load_interpreter(self, path):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found: {path}")
        interpreter = tf.lite.Interpreter(model_path=path)
        interpreter.allocate_tensors()
        return interpreter

    def _calculate_scale(self, min_scale, max_scale, stride_index, num_strides):
        if num_strides <= 1:
            return (min_scale + max_scale) * 0.5
        return min_scale + (max_scale - min_scale) * stride_index / (num_strides - 1.0)

    def _generate_anchors(self, options):
        anchors = []
        strides = options["strides"]
        num_layers = options["num_layers"]
        input_size_width = options["input_size_width"]
        input_size_height = options["input_size_height"]
        anchor_offset_x = options["anchor_offset_x"]
        anchor_offset_y = options["anchor_offset_y"]
        aspect_ratios = options["aspect_ratios"]
        
        layer_id = 0
        while layer_id < len(strides):
            anchor_height = []
            anchor_width = []
            
            last_same_stride_layer = layer_id
            while last_same_stride_layer < len(strides) and strides[last_same_stride_layer] == strides[layer_id]:
                stride_index = last_same_stride_layer
                scale = self._calculate_scale(options["min_scale"], options["max_scale"], stride_index, num_layers)
                
                anchor_width.append(scale)
                anchor_height.append(scale)
                
                if options.get("interpolated_scale_aspect_ratio", 0.0) > 0.0:
                    if last_same_stride_layer < num_layers - 1:
                        next_scale = self._calculate_scale(options["min_scale"], options["max_scale"], last_same_stride_layer + 1, num_layers)
                    else:
                        next_scale = 1.0
                    interpolated_scale = math.sqrt(scale * next_scale)
                    anchor_width.append(interpolated_scale)
                    anchor_height.append(interpolated_scale)
                    
                last_same_stride_layer += 1
                
            stride = strides[layer_id]
            feature_map_width = math.ceil(input_size_width / stride)
            feature_map_height = math.ceil(input_size_height / stride)
            
            for y in range(feature_map_height):
                for x in range(feature_map_width):
                    for i in range(len(anchor_width)):
                        x_center = (x + anchor_offset_x) / feature_map_width
                        y_center = (y + anchor_offset_y) / feature_map_height
                        w = anchor_width[i]
                        h = anchor_height[i]
                        anchors.append([x_center, y_center, w, h])
                        
            layer_id = last_same_stride_layer
            
        return np.array(anchors)

    def _decode_boxes(self, raw_boxes, anchors, img_w, img_h, scale=128.0):
        # Apply offset and scale factor relative to anchors
        x_center = raw_boxes[:, 0] / scale * anchors[:, 2] + anchors[:, 0]
        y_center = raw_boxes[:, 1] / scale * anchors[:, 3] + anchors[:, 1]
        w = raw_boxes[:, 2] / scale * anchors[:, 2]
        h = raw_boxes[:, 3] / scale * anchors[:, 3]
        
        # Convert to corners
        ymin = (y_center - h / 2.0) * img_h
        xmin = (x_center - w / 2.0) * img_w
        ymax = (y_center + h / 2.0) * img_h
        xmax = (x_center + w / 2.0) * img_w
        
        boxes = np.stack([ymin, xmin, ymax, xmax], axis=-1)
        
        # 6 keypoints: (y, x) format
        keypoints = np.zeros((len(raw_boxes), 6, 2))
        for j in range(6):
            kp_x = raw_boxes[:, 4 + 2*j] / scale * anchors[:, 2] + anchors[:, 0]
            kp_y = raw_boxes[:, 4 + 2*j + 1] / scale * anchors[:, 3] + anchors[:, 1]
            keypoints[:, j, 0] = kp_y * img_h
            keypoints[:, j, 1] = kp_x * img_w
            
        return boxes, keypoints

    def _nms(self, boxes, scores, iou_threshold=0.3):
        if len(boxes) == 0:
            return []
        
        ymin, xmin, ymax, xmax = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
        areas = (ymax - ymin) * (xmax - xmin)
        order = scores.argsort()[::-1]
        
        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)
            
            xx1 = np.maximum(xmin[i], xmin[order[1:]])
            yy1 = np.maximum(ymin[i], ymin[order[1:]])
            xx2 = np.minimum(xmax[i], xmax[order[1:]])
            yy2 = np.minimum(ymax[i], ymax[order[1:]])
            
            w = np.maximum(0.0, xx2 - xx1)
            h = np.maximum(0.0, yy2 - yy1)
            inter = w * h
            
            ovr = inter / (areas[i] + areas[order[1:]] - inter + 1e-8)
            inds = np.where(ovr <= iou_threshold)[0]
            order = order[inds + 1]
            
        return keep

    def decode_base64_image(self, base64_str):
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        img_data = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image data.")
        return img

    def get_face_embedding(self, img, is_front_camera=True, score_threshold=0.65):
        img_h, img_w, _ = img.shape
        
        # Select detector
        if is_front_camera:
            interpreter = self.front_interpreter
            anchors = self.anchors_128
            input_size = 128
        else:
            interpreter = self.back_interpreter
            anchors = self.anchors_256
            input_size = 256
            
        # Get input/output details
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        # Preprocess for detector: resize, RGB, normalise to [-1.0, 1.0]
        resized = cv2.resize(img, (input_size, input_size))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        normalized = (rgb.astype(np.float32) - 127.5) / 127.5
        input_data = np.expand_dims(normalized, axis=0)
        
        # Set tensor & run
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()
        
        # Retrieve outputs
        raw_regressors = interpreter.get_tensor(output_details[0]['index'])[0]    # [896, 16]
        raw_classificators = interpreter.get_tensor(output_details[1]['index'])[0] # [896, 1]
        
        # Sigmoid on score predictions
        scores = 1.0 / (1.0 + np.exp(-np.clip(raw_classificators[:, 0], -20.0, 20.0)))
        
        # Filter by threshold
        valid_indices = np.where(scores > score_threshold)[0]
        if len(valid_indices) == 0:
            raise ValueError("No face detected in the image.")
            
        filtered_boxes, filtered_keypoints = self._decode_boxes(
            raw_regressors[valid_indices], 
            anchors[valid_indices], 
            img_w, 
            img_h, 
            scale=float(input_size)
        )
        filtered_scores = scores[valid_indices]
        
        # Apply NMS
        keep = self._nms(filtered_boxes, filtered_scores, iou_threshold=0.3)
        if len(keep) == 0:
            raise ValueError("No valid face detected.")
        if len(keep) > 1:
            raise ValueError("Multiple faces detected. Please ensure only one person is in the camera frame.")
            
        # Extract the single detected face
        best_idx = keep[0]
        box = filtered_boxes[best_idx]
        kps = filtered_keypoints[best_idx]
        
        # Crop & Align Face using Left Eye (kps[0]) and Right Eye (kps[1])
        # Eye coordinates in (y, x) format
        left_eye = kps[0]
        right_eye = kps[1]
        
        # Calculate angle of rotation
        dy = right_eye[0] - left_eye[0]
        dx = right_eye[1] - left_eye[1]
        angle = np.degrees(np.arctan2(dy, dx))
        
        # Calculate center between eyes
        eye_center = (float((left_eye[1] + right_eye[1]) / 2), float((left_eye[0] + right_eye[0]) / 2))
        
        # Get rotation matrix and rotate the source image
        M = cv2.getRotationMatrix2D(eye_center, angle, 1.0)
        rotated_img = cv2.warpAffine(img, M, (img_w, img_h))
        
        # Redecode box coordinates in rotated frame (or use standard crop with padding)
        # For simplicity and reliability, crop from the aligned image using padding around eye center
        ymin, xmin, ymax, xmax = int(box[0]), int(box[1]), int(box[2]), int(box[3])
        
        h_box = ymax - ymin
        w_box = xmax - xmin
        
        # Apply safety bounds
        ymin = max(0, ymin - int(h_box * 0.1))
        xmin = max(0, xmin - int(w_box * 0.1))
        ymax = min(img_h, ymax + int(h_box * 0.1))
        xmax = min(img_w, xmax + int(w_box * 0.1))
        
        cropped_face = rotated_img[ymin:ymax, xmin:xmax]
        if cropped_face.size == 0:
            # Fallback to standard crop without rotation
            cropped_face = img[max(0, int(box[0])):min(img_h, int(box[2])), max(0, int(box[1])):min(img_w, int(box[3]))]
            
        if cropped_face.size == 0:
            raise ValueError("Failed to crop face region.")
            
        # Run MobileFaceNet on the cropped face
        # Input size: 112x112, normalise to [-1.0, 1.0]
        resized_face = cv2.resize(cropped_face, (112, 112))
        rgb_face = cv2.cvtColor(resized_face, cv2.COLOR_BGR2RGB)
        normalized_face = (rgb_face.astype(np.float32) - 127.5) / 127.5
        facenet_input = np.expand_dims(normalized_face, axis=0)
        
        # Run MobileFaceNet interpreter
        facenet_input_details = self.facenet_interpreter.get_input_details()
        facenet_output_details = self.facenet_interpreter.get_output_details()
        
        self.facenet_interpreter.set_tensor(facenet_input_details[0]['index'], facenet_input)
        self.facenet_interpreter.invoke()
        
        raw_embedding = self.facenet_interpreter.get_tensor(facenet_output_details[0]['index'])[0] # [128]
        
        # L2 normalize the embedding
        norm = np.linalg.norm(raw_embedding)
        if norm > 0:
            normalized_embedding = raw_embedding / norm
        else:
            normalized_embedding = raw_embedding
            
        return normalized_embedding.tolist()

    def compare_embeddings(self, embedding1, embedding2):
        """
        Calculates cosine similarity between two L2 normalized embeddings (lists).
        """
        arr1 = np.array(embedding1)
        arr2 = np.array(embedding2)
        
        # Since they are L2 normalized, cosine similarity is just the dot product
        similarity = np.dot(arr1, arr2)
        return float(similarity)
