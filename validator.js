
const ucFirst = (string) => {
    if (string && string.length > 0)
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

module.exports = {
    localValidation: (data, validationRule, error = {}, localvalidationerror = false) => {
        if (validationRule) {
            Object.keys(validationRule).map((item, key) => {
                for (let i = 0; i < validationRule[item].length; i++) {
                    let validate = validation(item, data[item], validationRule[item][i], data);
                    if (validate) {
                        error[item] = validate;
                        localvalidationerror = true;
                        break;
                    }
                }
            })
        }
        return {
            localvalidationerror,
            error
        }

        function validation(name, value, rule, data) {
            let r = rule.split(":");

            switch (r[0]) {
                case "required": {
                    return value || value === "0" ? null : [capitalString(name) + " field is required."]
                }
                case "email": {
                    let re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                    return re.test(value) ? null : [capitalString(name) + " is not a valid email."]
                }
                case "numeric": {
                    return !/\D/.test(value) ? null : [capitalString(name) + " field must be number."]
                }
                case "array": {
                    return Array.isArray(value) ? null : [capitalString(name) + " field must be array."]
                }
                case "min": {
                    if (typeof value === "string") {
                        return value.length < r[1] ? [capitalString(name) + " must be minimum of " + r[1] + " character."] : null
                    } else if (typeof value === "number") {
                        return value < r[1] ? [ucFirst(name) + " must be greater than or equals " + r[1] + " ."] : null
                    } else if (Array.isArray(value)) {
                        return value.length < r[1] ? [capitalString(name) + " must contain minimum of " + r[1] + " item."] : null
                    }
                    return null
                }
                case "greater_than": {
                    if (value > data[r[1]])
                        return null
                    else
                        return [capitalString(name) + " must be greater than " + r[1] + " ."]
                }
                case "max": {
                    if (typeof value === "string") {
                        return value.length > r[1] ? [capitalString(name) + " must be maximum of " + r[1] + " character."] : null
                    } else if (typeof value === "number") {
                        return value > r[1] ? [capitalString(name) + " must be less than or equals " + r[1] + " ."] : null
                    } else if (Array.isArray(value)) {
                        return value.length > r[1] ? [capitalString(name) + " must contain maximum of " + r[1] + " item."] : null
                    }
                    return null
                }
                case "in": {
                    let lists = r[1].split(",");
                    if (lists.includes(value)) {
                        return null
                    } else {
                        return [capitalString(name) + " is invalid."]
                    }
                }
                case "mac": {
                    let re = /^([a-fA-F0-9]{2}:[a-fA-F0-9]{2}:[a-fA-F0-9]{2}:[a-fA-F0-9]{2}:[a-fA-F0-9]{2}:[a-fA-F0-9]{2})$/
                    return re.test(value) ? null : [capitalString(name) + " is not valid. Must be hexadecimal number of format XX:XX:XX:XX:XX:XX"]

                }
                case "presentElement": {
                    return value.length > 0 ? null : [capitalString(name) + " is required."]
                }
                case "unique": {
                    let index = data[r[1]].indexOf(value);
                    return index < 0 ? null : [capitalString(name) + " already esists."]
                }
                case "url": {
                    let re = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;
                    if (value) {
                        return re.test(value) ? null : [capitalString(name) + " is not a valid Url."]
                    }
                    return null
                }
                case "image_dimensions": {
                    let dmsn = r[1].split("=")
                    dmsn[0] = dmsn[0].trim().toLowerCase()
                    switch (dmsn[0]) {
                        case "fixed": {
                            let vals = dmsn[1].split(",");
                            return ((parseInt(vals[0]) === parseInt(vals[2])) && (parseInt(vals[1]) === parseInt(vals[3]))) ? null :
                                ["Image height, width must be " + vals[0] + ", " + vals[1] + " ."]
                        }
                        case "min": {
                            let vals = dmsn[1].split(",");
                            return ((parseInt(vals[0]) <= parseInt(vals[2])) && (parseInt(vals[1]) <= parseInt(vals[3]))) ? null :
                                ["Image height, width must be mimimum of " + vals[0] + ", " + vals[1] + " ."]
                        }
                        case "max": {
                            let vals = dmsn[1].split(",");
                            return (parseInt(vals[0]) >= parseInt(vals[2]) && parseInt(vals[1]) >= parseInt(vals[3])) ? null :
                                ["Image height, width must be maximum of " + vals[0] + ", " + vals[1] + " ."]
                        }
                        default:
                    }
                }
                case "*": {

                }
                    break
                default:
                    return null
            }
        }

        function capitalString(string) {
            let array = string.split("_");
            array = array.map(item => {
                return ucFirst(item)
            })
            return array.join(" ")
        }

    }
}

/**
 * Documentation
 *
 * image_dimensions===>
 * image_dimensions:fixed=required_height,required_width,height,width
 * image_dimensions:max=required_height,required_width,height,width
 * image_dimensions:min=required_height,required_width,height,width
 *
**/

