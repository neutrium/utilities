//
//	NeutriumJS.utilities.nestedMap
//
//	A collection object for storing nested maps
//
//	Original implementation from https://github.com/gentooboontoo/js-quantities/
//

export class NestedMap
{
    get(keys: string[])
    {
        return keys.reduce(function(map, key, index) {
            if (map)
            {
                let childMap = map[key];

                if (index === keys.length - 1)
                {
                    return childMap ? childMap.data : undefined;
                }
                else
                {
                    return childMap;
                }
            }
        }, this);
    }

    set(keys: string[], value: any)
    {
        return keys.reduce(function(map, key, index) {
            let childMap = map[key];

            if (childMap === undefined)
            {
                childMap = map[key] = {};
            }

            if (index === keys.length - 1)
            {
                childMap.data = value;
                return value;
            }
            else
            {
                return childMap;
            }
        }, this);
    }
}