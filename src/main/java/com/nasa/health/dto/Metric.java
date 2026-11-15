package com.nasa.health.dto;

public class Metric {
    private String analyte;
    private double value;
    private String unit;

    public String getAnalyte() { return analyte; }
    public void setAnalyte(String analyte) { this.analyte = analyte; }

    public double getValue() { return value; }
    public void setValue(double value) { this.value = value; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
}
