import { useState, useEffect } from "react";
import "./PayloadForm.css";

const PayloadForm = ({
  prediction,
  onPayloadChange,
  initialPayload = {},
  disabled = false,
}) => {
  const [fieldValues, setFieldValues] = useState({});

  const getDefaultValue = (type, example) => {
    switch (type) {
      case "boolean":
        return false;
      case "number":
        return example ? parseFloat(example) || 0 : 0;
      case "array":
        return [];
      case "object":
        return {};
      default:
        return example || "";
    }
  };
  
  useEffect(() => {
    // Initialize field values from prediction and initial payload
    const values = {};
    if (prediction && prediction.fields) {
      prediction.fields.forEach((field) => {
        values[field.name] =
          initialPayload[field.name] ||
          getDefaultValue(field.type, field.example);
      });
    }
    setFieldValues(values);
  }, [prediction, initialPayload]);

  useEffect(() => {
    // Notify parent component of payload changes
    onPayloadChange(fieldValues);
  }, [fieldValues, onPayloadChange]);

  const handleFieldChange = (fieldName, value, type) => {
    let parsedValue = value;

    try {
      switch (type) {
        case "number":
          parsedValue = value === "" ? "" : parseFloat(value);
          break;
        case "boolean":
          parsedValue = value;
          break;
        case "array":
          parsedValue =
            typeof value === "string" ? JSON.parse(value || "[]") : value;
          break;
        case "object":
          parsedValue =
            typeof value === "string" ? JSON.parse(value || "{}") : value;
          break;
        default:
          parsedValue = value;
      }
    } catch (e) {
      // If parsing fails, keep the string value
      parsedValue = value;
    }

    setFieldValues((prev) => ({
      ...prev,
      [fieldName]: parsedValue,
    }));
  };

  const renderField = (field) => {
    const { name, type, required, example, description } = field;
    const value = fieldValues[name] || "";

    const baseProps = {
      id: `field-${name}`,
      className: `payload-field ${required ? "required" : ""}`,
      disabled,
    };

    let input;

    switch (type) {
      case "boolean":
        input = (
          <label className="checkbox-label">
            <input
              {...baseProps}
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(name, e.target.checked, type)}
            />
            <span className="checkbox-custom"></span>
            {description}
          </label>
        );
        break;

      case "number":
        input = (
          <input
            {...baseProps}
            type="number"
            value={value}
            placeholder={example}
            onChange={(e) => handleFieldChange(name, e.target.value, type)}
          />
        );
        break;

      case "array":
      case "object":
        input = (
          <textarea
            {...baseProps}
            value={
              typeof value === "string" ? value : JSON.stringify(value, null, 2)
            }
            placeholder={`Enter JSON ${type} (e.g., ${example || (type === "array" ? "[]" : "{}")})`}
            rows={3}
            onChange={(e) => handleFieldChange(name, e.target.value, type)}
          />
        );
        break;

      default: // string
        input = (
          <input
            {...baseProps}
            type="text"
            value={value}
            placeholder={example}
            onChange={(e) => handleFieldChange(name, e.target.value, type)}
          />
        );
    }

    return (
      <div key={name} className="field-group">
        <label htmlFor={`field-${name}`} className="field-label">
          {name}
          {required && <span className="required-indicator">*</span>}
          <span className="field-type">({type})</span>
        </label>
        {type !== "boolean" && description && (
          <p className="field-description">{description}</p>
        )}
        {input}
      </div>
    );
  };

  if (!prediction || !prediction.fields || prediction.fields.length === 0) {
    return null;
  }

  return (
    <div className="payload-form">
      <div className="form-header">
        <h3>Predicted Request Body</h3>
        <span className="field-count">{prediction.fields.length} fields</span>
      </div>

      <div className="form-fields">{prediction.fields.map(renderField)}</div>
    </div>
  );
};

export default PayloadForm;
